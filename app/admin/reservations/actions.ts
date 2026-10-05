"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { appUrl } from "@/lib/app-url";
import { feeBreakdown } from "@/lib/fees";
import { isPrelaunch } from "@/lib/prelaunch";
import {
  notifyFeePaymentConfirmed,
  notifyBankTransferRejected,
} from "@/lib/notifications";
import { evaluateReferralQualification } from "@/lib/referral-credit";
import { cleanEscrowReference, isEscrowStage } from "@/lib/escrow";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import {
  SESSION_ENDED,
  checkWrite,
  notSaved,
  savedWithAudit,
  type ActionResult,
} from "@/lib/action-result";

/**
 * Admin actions for the reservation queue (purchase_requests). Bound to
 * <ActionForm action={…}> with a hidden `id` field; each one reports
 * "Saved…" only after the write is confirmed, or "Not saved: <reason>",
 * and writes the admin audit log (migration 0056).
 *
 * middleware.ts gates /admin; requireAdmin() (lib/admin-auth.ts) re-checks
 * role + code; the "purchase requests admin update" RLS policy
 * (public.is_admin()) enforces it at the database.
 */
function idFrom(formData: FormData): string | null {
  const id = formData.get("id");
  return typeof id === "string" && id.length > 0 ? id : null;
}

const MISSING_ID = "the form is missing the reservation. Reload and try again.";

/** Move a fresh request into review. */
export async function markReservationUnderReview(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = idFrom(formData);
  if (!id) return notSaved(MISSING_ID);
  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);

  const res = await ctx.supabase
    .from("purchase_requests")
    .update({ status: "under_review" })
    .eq("id", id)
    .eq("status", "submitted")
    .select("id");
  const bad = checkWrite(res, "it's no longer a new request — reload to see its current state.");
  if (bad) return bad;

  const audit = await logAdminAction(ctx.supabase, "reservation.mark_under_review", {
    table: "purchase_requests",
    id,
  });
  revalidatePath("/admin/reservations");
  return savedWithAudit("Moved to review.", audit);
}

/** Release a reservation — the buyer no longer holds intent on the vehicle. */
export async function releaseReservation(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = idFrom(formData);
  if (!id) return notSaved(MISSING_ID);
  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);

  // Only release requests that are still open; a status filter keeps a
  // double-submit from clobbering a later state.
  const res = await ctx.supabase
    .from("purchase_requests")
    .update({ status: "cancelled" })
    .eq("id", id)
    .in("status", ["submitted", "under_review", "verified"])
    .select("id");
  const bad = checkWrite(res, "it's no longer open — reload to see its current state.");
  if (bad) return bad;

  const audit = await logAdminAction(ctx.supabase, "reservation.release", {
    table: "purchase_requests",
    id,
  });
  revalidatePath("/admin/reservations");
  return savedWithAudit("Reservation released.", audit);
}

/**
 * Generate (or regenerate) the buyer's Stripe Checkout link for their share of
 * ShipMova's service fee. Available once a reservation is past 'submitted'
 * (under_review / verified) and the fee hasn't been paid yet.
 *
 * The buyer pays only their portion — the full fee when the seller chose
 * "buyer pays full", half of it when the seller chose to split. On successful
 * payment the /api/stripe/payments/webhook endpoint flips
 * mova_fee_payment_status to 'paid'.
 *
 * The link is stored on the reservation and surfaced on the buyer's dashboard.
 *
 * Refused while PRELAUNCH is on (lib/prelaunch.ts): no ShipMova-fee checkout is
 * created before launch, so there is no link a buyer could pay.
 */
export async function requestFeePayment(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = idFrom(formData);
  if (!id) return notSaved(MISSING_ID);
  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);
  const { supabase } = ctx;
  if (isPrelaunch()) {
    return notSaved("ShipMova is in pre-launch, so no fee payment link can be created yet.");
  }

  const { data: pr } = await supabase
    .from("purchase_requests")
    .select(
      "id, vehicle_id, buyer_id, status, mova_fee_payment_status, vehicle_price_usd, mova_fee_usd, negotiated_price_usd, negotiated_price_status, shipping_rate_id, fee_payment_requested_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!pr) return notSaved("this reservation wasn't found.");
  if (pr.mova_fee_payment_status === "paid") return notSaved("the fee is already paid.");
  if (pr.status !== "under_review" && pr.status !== "verified") {
    return notSaved(`the reservation is ${pr.status.replace("_", " ")}, not in review.`);
  }
  // The buyer must have locked in a shipper/method before ShipMova sends an
  // invoice — see 0018. The reservations page hides this button and shows
  // why when shipping_rate_id is still null, so reaching here with it unset
  // shouldn't happen via the UI; bail rather than trust that alone.
  if (!pr.shipping_rate_id) return notSaved("the buyer hasn't chosen a shipper yet.");

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("year, make, model, trim, price_usd, fee_responsibility")
    .eq("id", pr.vehicle_id)
    .maybeSingle();
  if (!vehicle) return notSaved("the listing for this reservation wasn't found.");

  const { data: buyer } = await supabase
    .from("users")
    .select("email")
    .eq("id", pr.buyer_id)
    .maybeSingle();

  // Price the fee off the buyer-accepted negotiated price when there is one —
  // that's the actual final price for this reservation, and the whole point
  // of the negotiation feature is that Invoice 1 (this fee) is charged
  // against it, not the original listing price. Otherwise fall back to the
  // reservation-time snapshot, then the live listing (older reservations
  // predate the snapshot columns).
  const price =
    pr.negotiated_price_status === "accepted" && pr.negotiated_price_usd != null
      ? Number(pr.negotiated_price_usd)
      : pr.vehicle_price_usd != null
        ? Number(pr.vehicle_price_usd)
        : Number(vehicle.price_usd);
  const { fullFee, buyerFee } = feeBreakdown(price, vehicle.fee_responsibility);

  const amountCents = Math.round(buyerFee * 100);
  if (amountCents < 50) return notSaved("the fee is below Stripe's $0.50 minimum.");

  const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}${
    vehicle.trim ? ` ${vehicle.trim}` : ""
  }`;
  const origin = await appUrl();

  let session;
  try {
    session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: `ShipMova service fee — ${title}`,
            description:
              vehicle.fee_responsibility === "split"
                ? "Your half of ShipMova's 8% service fee (the seller's half comes out of their escrow payout)."
                : "ShipMova's 8% service fee.",
          },
        },
      },
    ],
    customer_email: buyer?.email ?? undefined,
    metadata: { purchase_request_id: pr.id },
    success_url: `${origin}/buyer/dashboard?fee=paid`,
    cancel_url: `${origin}/buyer/dashboard?fee=cancelled`,
    });
  } catch (err) {
    console.error("requestFeePayment: Stripe checkout failed:", err);
    return notSaved("Stripe couldn't create the payment link. Try again in a minute.");
  }

  const res = await supabase
    .from("purchase_requests")
    .update({
      vehicle_price_usd: price,
      mova_fee_usd: fullFee,
      mova_fee_stripe_session_id: session.id,
      mova_fee_checkout_url: session.url,
      // Only set the first time — the 24h auto-release clock (lib/auto-release.ts)
      // starts here, and regenerating a lapsed link shouldn't push the buyer's
      // deadline out indefinitely.
      fee_payment_requested_at: pr.fee_payment_requested_at ?? new Date().toISOString(),
    })
    .eq("id", pr.id)
    .eq("mova_fee_payment_status", "pending")
    .select("id");
  const bad = checkWrite(res, "the fee status changed meanwhile — reload to see it.");
  if (bad) return bad;

  const audit = await logAdminAction(supabase, "reservation.request_fee", {
    table: "purchase_requests",
    id: pr.id,
  }, { amount_usd: buyerFee, stripe_session: session.id });
  revalidatePath("/admin/reservations");
  revalidatePath("/buyer/dashboard");
  return savedWithAudit("Fee payment link created and shown to the buyer.", audit);
}

/**
 * Confirm a buyer's bank-transfer proof for ShipMova's fee: the manual
 * equivalent of the Stripe payments webhook (/api/stripe/payments/webhook) —
 * marks the fee paid. Nothing about the seller is revealed; the car price
 * goes through Escrow.com.
 *
 * Only reachable from 'pending_manual_verification' — the status a buyer's
 * proof upload puts the row into (app/buyer/dashboard/actions.ts,
 * enforced by purchase_requests_guard_negotiation, migration 0014). Buyers
 * themselves can never reach 'paid'; this admin action is the only path.
 */
export async function confirmBankTransferPayment(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = idFrom(formData);
  if (!id) return notSaved(MISSING_ID);
  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);
  const { supabase, adminId } = ctx;

  const { data: pr } = await supabase
    .from("purchase_requests")
    .select("id, vehicle_id, buyer_id, mova_fee_payment_status")
    .eq("id", id)
    .maybeSingle();
  if (!pr) return notSaved("this reservation wasn't found.");
  if (pr.mova_fee_payment_status !== "pending_manual_verification") {
    return notSaved("there's no bank transfer waiting to be checked on this reservation.");
  }

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("seller_id")
    .eq("id", pr.vehicle_id)
    .maybeSingle();

  const res = await supabase
    .from("purchase_requests")
    .update({
      mova_fee_payment_status: "paid",
      bank_transfer_reviewed_by: adminId,
      bank_transfer_reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("mova_fee_payment_status", "pending_manual_verification")
    .select("id");
  const bad = checkWrite(res, "the transfer was already reviewed — reload to see its current state.");
  if (bad) return bad;

  const audit = await logAdminAction(supabase, "reservation.confirm_bank_transfer", {
    table: "purchase_requests",
    id,
  });
  revalidatePath("/admin/reservations");
  revalidatePath("/buyer/dashboard");

  await notifyFeePaymentConfirmed(id);

  // Referral program: bank-transfer confirmation is the other path to
  // 'paid' (alongside the Stripe webhook) — same evaluation, run through
  // the service-role client since referral_credits grants no insert policy
  // to an admin's own authenticated session. See lib/referral-credit.ts.
  const adminClient = createAdminClient();
  await evaluateReferralQualification(adminClient, {
    referredUserId: pr.buyer_id,
    purchaseRequestId: id,
  });
  if (vehicle) {
    await evaluateReferralQualification(adminClient, { referredUserId: vehicle.seller_id });
  }
  return savedWithAudit("Bank transfer confirmed — fee marked paid and the buyer emailed.", audit);
}

/**
 * Reject a buyer's bank-transfer proof — not received / doesn't match. Sets
 * the reservation back to 'bank_transfer_rejected' with a reason the buyer
 * dashboard surfaces, and lets the buyer retry (either bank transfer again
 * or switch to card) rather than dead-ending the reservation.
 */
export async function rejectBankTransferPayment(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = idFrom(formData);
  if (!id) return notSaved(MISSING_ID);
  const reasonRaw = formData.get("rejection_reason");
  const reason = typeof reasonRaw === "string" ? reasonRaw.trim() : "";
  if (reason.length === 0) return notSaved("add a reason the buyer will see.");

  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);
  const { supabase, adminId } = ctx;

  const res = await supabase
    .from("purchase_requests")
    .update({
      mova_fee_payment_status: "bank_transfer_rejected",
      bank_transfer_rejection_reason: reason,
      bank_transfer_reviewed_by: adminId,
      bank_transfer_reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("mova_fee_payment_status", "pending_manual_verification")
    .select("id");
  const bad = checkWrite(res, "the transfer was already reviewed — reload to see its current state.");
  if (bad) return bad;

  const audit = await logAdminAction(supabase, "reservation.reject_bank_transfer", {
    table: "purchase_requests",
    id,
  }, { reason });
  revalidatePath("/admin/reservations");
  revalidatePath("/buyer/dashboard");

  await notifyBankTransferRejected(id, reason);
  return savedWithAudit("Transfer rejected — the buyer sees your reason and was emailed.", audit);
}


/**
 * Record what Escrow.com reports for this transaction: its reference and
 * the current stage (lib/escrow.ts). The stage history trigger (migration
 * 0055) logs every change with the admin who made it. RLS "purchase
 * requests admin update" plus requireAdmin (code-checked admin) gate it.
 *
 * Reports back to the form: success only once the saved values are read
 * back from the database, otherwise the reason. Never silent.
 */
export async function recordEscrow(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = idFrom(formData);
  if (!id) return notSaved(MISSING_ID);
  const stageRaw = formData.get("escrow_stage");
  if (stageRaw !== "" && !isEscrowStage(stageRaw)) return notSaved("unknown escrow stage.");
  const stage = isEscrowStage(stageRaw) ? stageRaw : null;
  const reference = cleanEscrowReference(formData.get("escrow_reference"));

  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);
  const { supabase } = ctx;

  const { data, error } = await supabase
    .from("purchase_requests")
    .update({ escrow_stage: stage, escrow_reference: reference })
    .eq("id", id)
    .select("escrow_stage, escrow_reference");
  if (error) {
    console.error("recordEscrow failed:", error);
    return notSaved(error.message);
  }
  const saved = data?.[0];
  if (!saved || saved.escrow_stage !== stage || saved.escrow_reference !== reference) {
    console.error("recordEscrow: update matched no row or didn't stick", { id, data });
    return notSaved("the database didn't accept the change. Reload, enter your code if asked, and try again.");
  }

  const audit = await logAdminAction(supabase, "reservation.record_escrow", {
    table: "purchase_requests",
    id,
  }, { escrow_stage: stage, escrow_reference: reference });
  revalidatePath("/admin/reservations");
  return savedWithAudit("Saved — recorded in this deal's history.", audit);
}
