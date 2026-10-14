import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserRole } from "@/types/database";
import {
  detectSelfReferralSignals,
  determinePayoutMethod,
  payoutBatchesTriggered,
  shouldFlagForReview,
  REFERRAL_FLAG_WINDOW_HOURS,
  type ReferralRole,
  type SignupSignals,
} from "@/lib/referrals";

type Client = SupabaseClient<Database>;

export type ReferralEvaluationResult =
  | { credited: true; creditId: string }
  | {
      credited: false;
      reason:
        | "no_referrer"
        | "referrer_ineligible"
        | "already_credited"
        | "not_verified"
        | "no_qualifying_transaction"
        | "self_referral_blocked";
    };

type ReferredRow = {
  id: string;
  referred_by: string | null;
  email: string | null;
  phone: string | null;
  signup_ip: string | null;
  signup_device_fingerprint: string | null;
};
type ReferrerRow = ReferredRow & { role: UserRole };

/**
 * Shared first half of every evaluate* function below: loads the referred
 * account and its referrer, and the two guards that apply no matter which
 * role is qualifying — already credited, and no referrer on file. Returns
 * null (having already produced the ReferralEvaluationResult) when either
 * guard fires.
 *
 * The referrer's own account role has NO bearing on which referrals they
 * can earn from (everyone can refer everyone, cross-role — see
 * lib/referrals.ts) — EXCEPT an admin account, which this blocks outright:
 * referring is a buyer/seller/shipper/inspector feature, not a staff payout
 * channel.
 */
async function loadReferredAndReferrer(
  admin: Client,
  referredUserId: string,
): Promise<{ referred: ReferredRow; referrer: ReferrerRow } | Extract<ReferralEvaluationResult, { credited: false }>> {
  const { data: referred } = await admin
    .from("users")
    .select("id, referred_by, email, phone, signup_ip, signup_device_fingerprint")
    .eq("id", referredUserId)
    .maybeSingle();
  if (!referred || !referred.referred_by) {
    return { credited: false, reason: "no_referrer" };
  }

  const { data: existing } = await admin
    .from("referral_credits")
    .select("id")
    .eq("referred_id", referredUserId)
    .maybeSingle();
  if (existing) {
    return { credited: false, reason: "already_credited" };
  }

  const { data: referrer } = await admin
    .from("users")
    .select("id, role, referred_by, email, phone, signup_ip, signup_device_fingerprint")
    .eq("id", referred.referred_by)
    .maybeSingle();
  if (!referrer) {
    return { credited: false, reason: "no_referrer" };
  }
  if (referrer.role === "admin") {
    return { credited: false, reason: "referrer_ineligible" };
  }

  return { referred, referrer };
}

/** Self-referral fraud check + the referral_credits insert, shared by every
 * evaluate* function. `referredPaymentFingerprint` only applies to a Buyer
 * credit (the fee payment's card) — null for every other role. */
async function checkAndInsertCredit(
  admin: Client,
  referrer: ReferrerRow,
  referred: ReferredRow,
  role: ReferralRole,
  refs: { purchaseRequestId: string | null; shipmentRequestId: string | null; inspectionId: string | null },
  referredPaymentFingerprint: string | null,
): Promise<ReferralEvaluationResult> {
  // A referrer who has themselves paid a Buyer fee before has a card
  // fingerprint worth comparing, regardless of their own account role or
  // what role THIS credit is for — it's a person-level signal, not a
  // role-level one.
  const { data: lastPaid } = await admin
    .from("purchase_requests")
    .select("mova_fee_payment_method_fingerprint")
    .eq("buyer_id", referrer.id)
    .eq("mova_fee_payment_status", "paid")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const referrerPaymentFingerprint = lastPaid?.mova_fee_payment_method_fingerprint ?? null;

  const referrerSignals: SignupSignals = {
    email: referrer.email,
    phone: referrer.phone,
    deviceFingerprint: referrer.signup_device_fingerprint,
    ip: referrer.signup_ip,
    paymentFingerprint: referrerPaymentFingerprint,
  };
  const referredSignals: SignupSignals = {
    email: referred.email,
    phone: referred.phone,
    deviceFingerprint: referred.signup_device_fingerprint,
    ip: referred.signup_ip,
    paymentFingerprint: referredPaymentFingerprint,
  };
  const check = detectSelfReferralSignals(referrerSignals, referredSignals);
  if (check.blocked) {
    return { credited: false, reason: "self_referral_blocked" };
  }

  const { data: inserted, error: insertError } = await admin
    .from("referral_credits")
    .insert({
      referrer_id: referrer.id,
      referred_id: referred.id,
      role,
      purchase_request_id: refs.purchaseRequestId,
      shipment_request_id: refs.shipmentRequestId,
      inspection_id: refs.inspectionId,
      email_pattern_match: check.signals.emailPatternMatch,
      phone_match: check.signals.phoneMatch,
      payment_fingerprint_match: check.signals.paymentFingerprintMatch,
      device_fingerprint_match: check.signals.deviceFingerprintMatch,
      ip_subnet_match: check.signals.ipSubnetMatch,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    // Unique-violation on referred_id means a concurrent call already
    // credited this account — treat as success-but-idempotent, not a failure.
    if (insertError?.code === "23505") {
      return { credited: false, reason: "already_credited" };
    }
    console.error("referral_credits insert failed:", insertError);
    return { credited: false, reason: "no_qualifying_transaction" };
  }

  await afterCredit(admin, referrer.id, inserted.id);
  return { credited: true, creditId: inserted.id };
}

/**
 * Buyer/Seller referral qualification — the Stripe payments webhook and
 * confirmBankTransferPayment (both after a fee lands on 'paid') for Buyer
 * referrals, plus those same two PLUS the Stripe Identity webhook (after a
 * Seller's own KYC lands on 'verified') for Seller referrals, since either
 * side of that pair can complete second.
 *
 * `referredUserId` is the account that might now be a completed, qualifying
 * referral. Which of Buyer/Seller applies is read off `referred.role`
 * (unlike the referrer, the REFERRED account's role really is authoritative
 * here — a Buyer completes a purchase, a Seller completes a sale).
 * `purchaseRequestId`, when given, is the specific reservation whose fee
 * just landed on 'paid' — used directly for a Buyer's qualifying
 * transaction. For a Seller (whose own vehicles are the transactions, not
 * their own fee payments) this always re-resolves to that seller's own
 * earliest 'paid' purchase_request, regardless of which call site triggered
 * the check.
 *
 * Runs entirely through the passed-in client, which callers must pass as
 * the service-role admin client (lib/supabase/admin.ts) — referral_credits
 * grants no insert policy to anon/authenticated at all, matching
 * rate_limit_hits' shape (see migration 0030).
 */
export async function evaluateReferralQualification(
  admin: Client,
  params: { referredUserId: string; purchaseRequestId?: string },
): Promise<ReferralEvaluationResult> {
  const { referredUserId } = params;

  const { data: referredRole } = await admin
    .from("users")
    .select("role")
    .eq("id", referredUserId)
    .maybeSingle();
  if (referredRole?.role !== "buyer" && referredRole?.role !== "seller") {
    return { credited: false, reason: "no_referrer" };
  }
  const role: ReferralRole = referredRole.role;

  const loaded = await loadReferredAndReferrer(admin, referredUserId);
  if ("reason" in loaded) return loaded;
  const { referred, referrer } = loaded;

  const verified =
    role === "seller"
      ? (
          await admin
            .from("seller_profiles")
            .select("id_verification_status")
            .eq("user_id", referredUserId)
            .maybeSingle()
        ).data?.id_verification_status === "verified"
      : (
          await admin
            .from("buyer_profiles")
            .select("verification_status")
            .eq("user_id", referredUserId)
            .maybeSingle()
        ).data?.verification_status === "verified";
  if (!verified) {
    return { credited: false, reason: "not_verified" };
  }

  let qualifyingPurchaseRequestId: string | null = null;
  let referredPaymentFingerprint: string | null = null;

  if (role === "buyer") {
    if (!params.purchaseRequestId) {
      return { credited: false, reason: "no_qualifying_transaction" };
    }
    const { data: pr } = await admin
      .from("purchase_requests")
      .select("id, mova_fee_payment_method_fingerprint")
      .eq("id", params.purchaseRequestId)
      .eq("buyer_id", referredUserId)
      .eq("mova_fee_payment_status", "paid")
      .maybeSingle();
    if (!pr) {
      return { credited: false, reason: "no_qualifying_transaction" };
    }
    qualifyingPurchaseRequestId = pr.id;
    referredPaymentFingerprint = pr.mova_fee_payment_method_fingerprint;
  } else {
    const { data: ownVehicles } = await admin.from("vehicles").select("id").eq("seller_id", referredUserId);
    const vehicleIds = (ownVehicles ?? []).map((v) => v.id);
    const { data: pr } =
      vehicleIds.length > 0
        ? await admin
            .from("purchase_requests")
            .select("id")
            .in("vehicle_id", vehicleIds)
            .eq("mova_fee_payment_status", "paid")
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle()
        : { data: null };
    if (!pr) {
      return { credited: false, reason: "no_qualifying_transaction" };
    }
    qualifyingPurchaseRequestId = pr.id;
  }

  return checkAndInsertCredit(
    admin,
    referrer,
    referred,
    role,
    { purchaseRequestId: qualifyingPurchaseRequestId, shipmentRequestId: null, inspectionId: null },
    referredPaymentFingerprint,
  );
}

/**
 * Shipper referral qualification — call after a shipment flips to
 * 'completed' (app/admin/shipments/actions.ts, both branches). Re-resolves
 * the shipper's own earliest completed shipment itself, same "first
 * qualifying transaction, looked up fresh" pattern as the Seller branch
 * above, so it's correct no matter which of their shipments triggered it.
 */
export async function evaluateShipperReferral(
  admin: Client,
  params: { referredUserId: string },
): Promise<ReferralEvaluationResult> {
  const loaded = await loadReferredAndReferrer(admin, params.referredUserId);
  if ("reason" in loaded) return loaded;
  const { referred, referrer } = loaded;

  const { data: shipper } = await admin
    .from("shippers")
    .select("id")
    .eq("user_id", params.referredUserId)
    .eq("status", "approved")
    .maybeSingle();
  if (!shipper) {
    return { credited: false, reason: "no_qualifying_transaction" };
  }
  const { data: shipment } = await admin
    .from("shipment_requests")
    .select("id")
    .eq("shipper_id", shipper.id)
    .eq("status", "completed")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!shipment) {
    return { credited: false, reason: "no_qualifying_transaction" };
  }

  return checkAndInsertCredit(
    admin,
    referrer,
    referred,
    "shipper",
    { purchaseRequestId: null, shipmentRequestId: shipment.id, inspectionId: null },
    null,
  );
}

/**
 * Inspector referral qualification — call after an inspection's pay_status
 * flips to 'paid' (app/admin/inspections/actions.ts). "First PAID
 * inspection", not merely passed: an inspection can pass without ever being
 * paid (pay_status stays 'owed' until an admin marks it), and that's not a
 * qualifying transaction yet.
 */
export async function evaluateInspectorReferral(
  admin: Client,
  params: { referredUserId: string },
): Promise<ReferralEvaluationResult> {
  const loaded = await loadReferredAndReferrer(admin, params.referredUserId);
  if ("reason" in loaded) return loaded;
  const { referred, referrer } = loaded;

  const { data: inspector } = await admin
    .from("inspectors")
    .select("id")
    .eq("user_id", params.referredUserId)
    .eq("status", "approved")
    .maybeSingle();
  if (!inspector) {
    return { credited: false, reason: "no_qualifying_transaction" };
  }
  const { data: inspection } = await admin
    .from("inspections")
    .select("id")
    .eq("inspector_id", inspector.id)
    .eq("pay_status", "paid")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!inspection) {
    return { credited: false, reason: "no_qualifying_transaction" };
  }

  return checkAndInsertCredit(
    admin,
    referrer,
    referred,
    "inspector",
    { purchaseRequestId: null, shipmentRequestId: null, inspectionId: inspection.id },
    null,
  );
}

/** Runs the batch-payout and rate-flag side effects after a credit lands. */
async function afterCredit(admin: Client, referrerId: string, newCreditId: string): Promise<void> {
  const { count: totalAfter } = await admin
    .from("referral_credits")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", referrerId);
  const after = totalAfter ?? 1;
  const before = after - 1;

  const batchesToCreate = payoutBatchesTriggered(before, after);
  for (let i = 0; i < batchesToCreate; i++) {
    await createReferralPayoutBatch(admin, referrerId);
  }

  const windowStart = new Date(Date.now() - REFERRAL_FLAG_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const { count: inWindow } = await admin
    .from("referral_credits")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", referrerId)
    .gte("created_at", windowStart);

  if (shouldFlagForReview(inWindow ?? 1)) {
    await admin.from("referral_credits").update({ flag_status: "flagged" }).eq("id", newCreditId);
  }
}

/**
 * Which role a batch's payout method is decided from — the REFERRER's own
 * standing on ShipMova, which has nothing to do with which role(s) the 10
 * credits in the batch happen to be for (a batch can mix a referred buyer,
 * a referred shipper and so on; `referral_credits.role` records each
 * credit's own qualifying role, `referral_payout_batches.role` records the
 * referrer's). Checked most-specific first: an approved inspector or
 * shipper row is more informative about THIS person than their base
 * buyer/seller account role, since inspecting/shipping is what they
 * actually do on ShipMova.
 */
async function resolveReferrerPayoutRole(admin: Client, referrerId: string): Promise<ReferralRole> {
  const [{ data: inspector }, { data: shipper }, { data: user }] = await Promise.all([
    admin.from("inspectors").select("id").eq("user_id", referrerId).eq("status", "approved").maybeSingle(),
    admin.from("shippers").select("id").eq("user_id", referrerId).eq("status", "approved").maybeSingle(),
    admin.from("users").select("role").eq("id", referrerId).maybeSingle(),
  ]);
  if (inspector) return "inspector";
  if (shipper) return "shipper";
  return user?.role === "seller" ? "seller" : "buyer";
}

/**
 * Creates the next $1,000 payout batch for a referrer and assigns their
 * oldest 10 unbatched credits to it (REFERRAL_BATCH_SIZE, REFERRAL_PAYOUT_
 * AMOUNT_USD — lib/referrals.ts; $100 per credit). Payout itself is
 * admin-confirmed (see app/admin/referrals/actions.ts) — this only opens
 * the ledger entry.
 */
export async function createReferralPayoutBatch(admin: Client, referrerId: string): Promise<void> {
  const { data: lastBatch } = await admin
    .from("referral_payout_batches")
    .select("batch_number")
    .eq("referrer_id", referrerId)
    .order("batch_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const batchNumber = (lastBatch?.batch_number ?? 0) + 1;

  const payoutRole = await resolveReferrerPayoutRole(admin, referrerId);
  const profileTable =
    payoutRole === "seller" ? "seller_profiles" : payoutRole === "buyer" ? "buyer_profiles" : null;
  const { data: profile } = profileTable
    ? await admin.from(profileTable).select("country").eq("user_id", referrerId).maybeSingle()
    : { data: null };
  const method = determinePayoutMethod(payoutRole, profile?.country ?? null);

  const { data: batch, error } = await admin
    .from("referral_payout_batches")
    .insert({
      referrer_id: referrerId,
      role: payoutRole,
      batch_number: batchNumber,
      method,
    })
    .select("id")
    .single();

  if (error || !batch) {
    console.error("createReferralPayoutBatch insert failed:", error);
    return;
  }

  const { data: unbatched } = await admin
    .from("referral_credits")
    .select("id")
    .eq("referrer_id", referrerId)
    .is("payout_batch_id", null)
    .order("created_at", { ascending: true })
    .limit(10);

  const ids = (unbatched ?? []).map((c) => c.id);
  if (ids.length > 0) {
    await admin.from("referral_credits").update({ payout_batch_id: batch.id }).in("id", ids);
  }
}
