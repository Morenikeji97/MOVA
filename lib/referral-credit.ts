import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
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
        | "already_credited"
        | "cross_role"
        | "not_verified"
        | "no_qualifying_transaction"
        | "self_referral_blocked";
    };

/**
 * The single call path every crediting trigger goes through — the Stripe
 * payments webhook and confirmBankTransferPayment (both after a fee lands
 * on 'paid') for Buyer referrals, plus those same two PLUS the Stripe
 * Identity webhook (after a Seller's own KYC lands on 'verified') for
 * Seller referrals, since either side of that pair can complete second.
 *
 * `referredUserId` is the account that might now be a completed, qualifying
 * referral. `purchaseRequestId`, when given, is the specific reservation
 * whose fee just landed on 'paid' — used directly for a Buyer's qualifying
 * transaction. For a Seller (whose own vehicles are the transactions, not
 * their own fee payments) this always re-resolves to that seller's own
 * earliest 'paid' purchase_request, regardless of which call site triggered
 * the check, so the ledger's purchase_request_id means the same thing
 * ("this referred account's first qualifying transaction") for both roles.
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

  const { data: referred } = await admin
    .from("users")
    .select("id, role, referred_by, email, phone, signup_ip, signup_device_fingerprint")
    .eq("id", referredUserId)
    .maybeSingle();
  if (!referred || !referred.referred_by) {
    return { credited: false, reason: "no_referrer" };
  }
  if (referred.role !== "buyer" && referred.role !== "seller") {
    return { credited: false, reason: "cross_role" };
  }
  const role = referred.role as ReferralRole;

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
    .select("id, role, email, phone, signup_ip, signup_device_fingerprint")
    .eq("id", referred.referred_by)
    .maybeSingle();
  if (!referrer || referrer.role !== role) {
    return { credited: false, reason: "cross_role" };
  }

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
    const { data: ownVehicles } = await admin
      .from("vehicles")
      .select("id")
      .eq("seller_id", referredUserId);
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

  let referrerPaymentFingerprint: string | null = null;
  if (role === "buyer") {
    const { data: lastPaid } = await admin
      .from("purchase_requests")
      .select("mova_fee_payment_method_fingerprint")
      .eq("buyer_id", referrer.id)
      .eq("mova_fee_payment_status", "paid")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    referrerPaymentFingerprint = lastPaid?.mova_fee_payment_method_fingerprint ?? null;
  }

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
      referred_id: referredUserId,
      role,
      purchase_request_id: qualifyingPurchaseRequestId,
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

  await afterCredit(admin, referrer.id, role, inserted.id);

  return { credited: true, creditId: inserted.id };
}

/** Runs the batch-payout and rate-flag side effects after a credit lands. */
async function afterCredit(
  admin: Client,
  referrerId: string,
  role: ReferralRole,
  newCreditId: string,
): Promise<void> {
  const { count: totalAfter } = await admin
    .from("referral_credits")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", referrerId);
  const after = totalAfter ?? 1;
  const before = after - 1;

  const batchesToCreate = payoutBatchesTriggered(before, after);
  for (let i = 0; i < batchesToCreate; i++) {
    await createReferralPayoutBatch(admin, referrerId, role);
  }

  const windowStart = new Date(
    Date.now() - REFERRAL_FLAG_WINDOW_HOURS * 60 * 60 * 1000,
  ).toISOString();
  const { count: inWindow } = await admin
    .from("referral_credits")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", referrerId)
    .gte("created_at", windowStart);

  if (shouldFlagForReview(inWindow ?? 1)) {
    await admin
      .from("referral_credits")
      .update({ flag_status: "flagged" })
      .eq("id", newCreditId);
  }
}

/**
 * Creates the next $1,000 payout batch for a referrer and assigns their
 * oldest 10 unbatched credits to it. Payout itself is admin-confirmed (see
 * app/admin/referrals/actions.ts) — this only opens the ledger entry.
 */
export async function createReferralPayoutBatch(
  admin: Client,
  referrerId: string,
  role: ReferralRole,
): Promise<void> {
  const { data: lastBatch } = await admin
    .from("referral_payout_batches")
    .select("batch_number")
    .eq("referrer_id", referrerId)
    .order("batch_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const batchNumber = (lastBatch?.batch_number ?? 0) + 1;

  const { data: profile } = await admin
    .from(role === "seller" ? "seller_profiles" : "buyer_profiles")
    .select("country")
    .eq("user_id", referrerId)
    .maybeSingle();
  const method = determinePayoutMethod(role, profile?.country ?? null);

  const { data: batch, error } = await admin
    .from("referral_payout_batches")
    .insert({
      referrer_id: referrerId,
      role,
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
