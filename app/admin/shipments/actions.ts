"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { round2 } from "@/lib/fees";
import { SHIPPER_FEES_ENABLED, commissionOwed } from "@/lib/shipping";
import {
  applyStandingAfterFailure,
  maybeRestoreGoodStanding,
} from "@/lib/shipper-billing";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { SESSION_ENDED, checkWrite, notSaved, savedWithAudit, type ActionResult } from "@/lib/action-result";
import { openShippingEscrow } from "@/lib/escrow-sync";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}


/** Pull a PaymentIntent id out of a thrown Stripe off-session card error. */
function extractPaymentIntentId(err: unknown): string | null {
  if (err && typeof err === "object") {
    const pi = (err as { payment_intent?: { id?: string } | null })
      .payment_intent;
    if (pi && typeof pi.id === "string") return pi.id;
  }
  return null;
}

function revalidate() {
  revalidatePath("/admin/shipments");
  revalidatePath("/admin/shippers");
  revalidatePath("/admin/dashboard");
}

/**
 * Mark a shipment request completed and collect ShipMova's commission.
 *
 * The completion is recorded first and stands regardless of the charge result.
 * Then an off-session PaymentIntent is charged against the shipper's saved card
 * for `commission_owed`:
 *   - success            -> commission_charge_status = 'charged'
 *   - needs 3DS / declined / no card -> 'failed', shipper -> 'past_due'
 *     (and -> 'suspended' once unpaid commissions exceed the threshold)
 * The shipper-commission webhook later reconciles the same PaymentIntent.
 *
 * Runs through the service role because it must read the shippers.stripe_*
 * token columns, which are not granted to the authenticated role.
 */
export async function completeShipment(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = str(formData.get("id"));
  if (!id) return notSaved("the form is missing the shipment. Reload and try again.");
  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);

  const admin = createAdminClient();

  const { data: sr } = await admin
    .from("shipment_requests")
    .select(
      "id, shipper_id, agreed_rate, currency, commission_pct, commission_owed, status",
    )
    .eq("id", id)
    .maybeSingle();
  if (!sr) return notSaved("this shipment wasn't found.");
  if (sr.status !== "pending") return notSaved("it's already completed — reload to see it.");

  // No shipper fees (lib/shipping.ts): complete without touching Stripe, even
  // for an older row saved with a non-zero commission_pct.
  if (!SHIPPER_FEES_ENABLED) {
    const res = await admin
      .from("shipment_requests")
      .update({ status: "completed", commission_owed: 0 })
      .eq("id", id)
      .eq("status", "pending")
      .select("id");
    const bad = checkWrite(res, "it's already completed — reload to see it.");
    if (bad) return bad;
    const audit = await logAdminAction(ctx.supabase, "shipment.complete", { table: "shipment_requests", id });
    revalidate();
    return savedWithAudit("Shipment marked completed. No fee charged.", audit);
  }

  const { data: shipper } = await admin
    .from("shippers")
    .select("id, stripe_customer_id, stripe_payment_method_id")
    .eq("id", sr.shipper_id)
    .maybeSingle();

  const owed =
    sr.commission_owed != null && Number(sr.commission_owed) > 0
      ? round2(Number(sr.commission_owed))
      : commissionOwed(Number(sr.agreed_rate), Number(sr.commission_pct));

  // Record the completion up front — it holds whatever the charge does.
  const done = await admin
    .from("shipment_requests")
    .update({ status: "completed", commission_owed: owed })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  const notDone = checkWrite(done, "it's already completed — reload to see it.");
  if (notDone) return notDone;
  const audit = await logAdminAction(ctx.supabase, "shipment.complete", { table: "shipment_requests", id }, {
    commission_owed: owed,
  });

  const currency = (sr.currency || "USD").toLowerCase();
  // Minor units. ShipMova's shipping lanes price in USD-like 2-decimal currencies.
  const amountMinor = Math.round(owed * 100);

  // Below Stripe's minimum — treat as settled, nothing to charge.
  if (amountMinor < 50) {
    await admin
      .from("shipment_requests")
      .update({ commission_charge_status: "charged" })
      .eq("id", id);
    revalidate();
    return savedWithAudit("Shipment completed. Commission below Stripe's minimum, nothing charged.", audit);
  }

  // No usable card on file — can't collect; flag it and dock the shipper.
  if (!shipper?.stripe_customer_id || !shipper?.stripe_payment_method_id) {
    await admin
      .from("shipment_requests")
      .update({ commission_charge_status: "failed" })
      .eq("id", id);
    await applyStandingAfterFailure(admin, sr.shipper_id);
    revalidate();
    return savedWithAudit("Shipment completed, but the commission couldn't be charged: no card on file.", audit);
  }

  try {
    const pi = await getStripe().paymentIntents.create({
      amount: amountMinor,
      currency,
      customer: shipper.stripe_customer_id,
      payment_method: shipper.stripe_payment_method_id,
      payment_method_types: ["card"],
      off_session: true,
      confirm: true,
      error_on_requires_action: true,
      description: `ShipMova ${sr.commission_pct}% commission — shipment ${id}`,
      metadata: { shipment_request_id: id, shipper_id: sr.shipper_id },
    });

    const chargeStatus = pi.status === "succeeded" ? "charged" : "pending";
    await admin
      .from("shipment_requests")
      .update({
        commission_charge_status: chargeStatus,
        stripe_charge_id: pi.id,
      })
      .eq("id", id);

    if (chargeStatus === "charged") {
      await maybeRestoreGoodStanding(admin, sr.shipper_id);
    }
    revalidate();
    return savedWithAudit(
      chargeStatus === "charged" ? "Shipment completed and commission charged." : "Shipment completed; the charge is still processing.",
      audit,
    );
  } catch (err) {
    console.error("shipper commission charge failed:", err);
    await admin
      .from("shipment_requests")
      .update({
        commission_charge_status: "failed",
        stripe_charge_id: extractPaymentIntentId(err),
      })
      .eq("id", id);
    await applyStandingAfterFailure(admin, sr.shipper_id);
    revalidate();
    return savedWithAudit("Shipment completed, but the commission charge failed.", audit);
  }
}

/** Open the shipping escrow (inland + ocean milestones) at Escrow.com. */
export async function openShippingEscrowAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = str(formData.get("id"));
  if (!id) return notSaved("the form is missing the shipment. Reload and try again.");
  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);
  const result = await openShippingEscrow(id);
  if (!result.ok) return notSaved(result.message);
  const audit = await logAdminAction(ctx.supabase, "escrow.open_shipping", { table: "shipment_requests", id }, { result: result.message });
  revalidatePath("/admin/shipments");
  revalidatePath("/buyer/dashboard");
  return savedWithAudit(result.message, audit);
}
