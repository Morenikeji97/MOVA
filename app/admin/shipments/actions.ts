"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { round2 } from "@/lib/fees";
import { commissionOwed } from "@/lib/shipping";
import {
  applyStandingAfterFailure,
  maybeRestoreGoodStanding,
} from "@/lib/shipper-billing";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "admin";
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
 * Mark a shipment request completed and collect MOVA's commission.
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
export async function completeShipment(formData: FormData): Promise<void> {
  const id = str(formData.get("id"));
  if (!id) return;
  if (!(await requireAdmin())) return;

  const admin = createAdminClient();

  const { data: sr } = await admin
    .from("shipment_requests")
    .select(
      "id, shipper_id, agreed_rate, currency, commission_pct, commission_owed, status",
    )
    .eq("id", id)
    .maybeSingle();
  if (!sr || sr.status !== "pending") return;

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
  await admin
    .from("shipment_requests")
    .update({ status: "completed", commission_owed: owed })
    .eq("id", id)
    .eq("status", "pending");

  const currency = (sr.currency || "USD").toLowerCase();
  // Minor units. MOVA's shipping lanes price in USD-like 2-decimal currencies.
  const amountMinor = Math.round(owed * 100);

  // Below Stripe's minimum — treat as settled, nothing to charge.
  if (amountMinor < 50) {
    await admin
      .from("shipment_requests")
      .update({ commission_charge_status: "charged" })
      .eq("id", id);
    revalidate();
    return;
  }

  // No usable card on file — can't collect; flag it and dock the shipper.
  if (!shipper?.stripe_customer_id || !shipper?.stripe_payment_method_id) {
    await admin
      .from("shipment_requests")
      .update({ commission_charge_status: "failed" })
      .eq("id", id);
    await applyStandingAfterFailure(admin, sr.shipper_id);
    revalidate();
    return;
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
      description: `MOVA ${sr.commission_pct}% commission — shipment ${id}`,
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
  }

  revalidate();
}
