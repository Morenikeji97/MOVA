"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SHIPPER_COMMISSION_PCT, commissionOwed } from "@/lib/shipping";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Buyer picks a shipper's rate once they've requested a vehicle
 * (/browse/[id]). This is a one-time pick, not a freely-editable one: once a
 * shipment_requests row exists for this purchase_request (any shipper), the
 * action no-ops on any further "Select" click. Letting a buyer switch
 * shippers after the fact would leave the first shipper's shipment_requests
 * row dangling — visible on their dashboard with nothing to clear it,
 * since there's no buyer-facing delete path for that table (RLS defines no
 * DELETE policy on shipment_requests at all). The DB trigger backing
 * purchase_requests.shipping_rate_id (0018) technically allows reselection
 * pre-invoice, but this action is the only thing that ever calls it, so that
 * flexibility currently goes unused — a future "change shipper" flow would
 * need to also handle retiring the old shipment_requests row before this
 * limitation could lift.
 *
 * Creates a shipment_requests row and snapshots both sides' contact details
 * onto it — shipper contact revealed to the buyer, buyer contact revealed to
 * the shipper — the same pattern purchase_requests uses for seller contact.
 * There is no buyer-facing Stripe step; MOVA's commission is charged to the
 * shipper later.
 *
 * The rate is validated against shipper_rates_public, which already excludes
 * suspended and non-approved shippers.
 */
export async function selectShippingRate(formData: FormData): Promise<void> {
  const rateId = str(formData.get("rateId"));
  const vehicleId = str(formData.get("vehicleId"));
  const purchaseRequestId = str(formData.get("purchaseRequestId"));
  if (!rateId || !purchaseRequestId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("users")
    .select("role, phone, whatsapp_number, email")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "buyer") return;

  // The purchase_request must actually be this buyer's.
  const { data: purchaseRequest } = await supabase
    .from("purchase_requests")
    .select("id, buyer_id")
    .eq("id", purchaseRequestId)
    .eq("buyer_id", user.id)
    .maybeSingle();
  if (!purchaseRequest) return;

  // Already picked (any shipper) — see the doc comment above.
  const { data: alreadySelected } = await supabase
    .from("shipment_requests")
    .select("id")
    .eq("purchase_request_id", purchaseRequestId)
    .maybeSingle();
  if (alreadySelected) {
    if (vehicleId) revalidatePath(`/browse/${vehicleId}`);
    return;
  }

  const { data: rate } = await supabase
    .from("shipper_rates_public")
    .select("rate_id, shipper_id, price, currency")
    .eq("rate_id", rateId)
    .maybeSingle();
  if (!rate || !rate.shipper_id) return;

  const { data: shipper } = await supabase
    .from("shippers")
    .select(
      "id, company_name, contact_name, contact_email, contact_phone, status, payment_status",
    )
    .eq("id", rate.shipper_id)
    .maybeSingle();
  if (
    !shipper ||
    shipper.status !== "approved" ||
    shipper.payment_status === "suspended"
  ) {
    return;
  }

  const { data: buyerProfile } = await supabase
    .from("buyer_profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("year, make, model, trim, location_city, location_state")
    .eq("id", vehicleId)
    .maybeSingle();

  const agreedRate = Number(rate.price) || 0;
  const owed = commissionOwed(agreedRate, SHIPPER_COMMISSION_PCT);
  const now = new Date().toISOString();

  const { error } = await supabase.from("shipment_requests").insert({
    shipper_id: rate.shipper_id,
    shipping_rate_id: rate.rate_id,
    buyer_id: user.id,
    purchase_request_id: purchaseRequestId,
    agreed_rate: agreedRate,
    currency: rate.currency ?? "USD",
    commission_pct: SHIPPER_COMMISSION_PCT,
    commission_owed: owed,
    commission_charge_status: "pending",
    status: "pending",
    shipper_details_revealed_at: now,
    shipper_company_name: shipper.company_name,
    shipper_contact_name: shipper.contact_name,
    shipper_contact_email: shipper.contact_email,
    shipper_contact_phone: shipper.contact_phone,
    buyer_details_revealed_at: now,
    buyer_name: buyerProfile?.full_name ?? null,
    buyer_email: profile?.email ?? user.email ?? null,
    buyer_phone: profile?.phone ?? null,
    buyer_whatsapp: profile?.whatsapp_number ?? null,
    vehicle_year: vehicle?.year ?? null,
    vehicle_make: vehicle?.make ?? null,
    vehicle_model: vehicle?.model ?? null,
    vehicle_trim: vehicle?.trim ?? null,
    pickup_city: vehicle?.location_city ?? null,
    pickup_state: vehicle?.location_state ?? null,
  });
  if (error) {
    console.error("selectShippingRate insert failed:", error);
    return;
  }

  // Locks in the buyer's choice on the reservation itself — this is what
  // requestFeePayment (admin) requires before it will generate Invoice 1,
  // and what the itemized all-in total reads. Guarded by the
  // purchase_requests_guard_negotiation trigger (0018): only settable
  // pre-invoice, and only to a rate matching this vehicle's size class —
  // both already true here, but the trigger is the actual enforcement.
  await supabase
    .from("purchase_requests")
    .update({ shipping_rate_id: rate.rate_id })
    .eq("id", purchaseRequestId);

  if (vehicleId) revalidatePath(`/browse/${vehicleId}`);
  revalidatePath("/buyer/dashboard");
}
