"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SHIPPER_COMMISSION_PCT, commissionOwed } from "@/lib/shipping";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Buyer picks a shipper's rate at reservation time (/browse/[id]).
 *
 * Creates a shipment_requests row and snapshots the shipper's contact details
 * onto it, so the buyer's dashboard/listing keeps a stable record of who to
 * contact — the same pattern purchase_requests uses for seller contact. There
 * is no buyer-facing Stripe step; MOVA's commission is charged to the shipper
 * later.
 *
 * The rate is validated against shipper_rates_public, which already excludes
 * suspended and non-approved shippers.
 */
export async function selectShippingRate(formData: FormData): Promise<void> {
  const rateId = str(formData.get("rateId"));
  const vehicleId = str(formData.get("vehicleId"));
  if (!rateId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "buyer") return;

  const { data: rate } = await supabase
    .from("shipper_rates_public")
    .select("rate_id, shipper_id, price, currency")
    .eq("rate_id", rateId)
    .maybeSingle();
  if (!rate || !rate.shipper_id) return;

  // One shipment request per buyer + shipper.
  const { data: existing } = await supabase
    .from("shipment_requests")
    .select("id")
    .eq("buyer_id", user.id)
    .eq("shipper_id", rate.shipper_id)
    .maybeSingle();
  if (existing) {
    if (vehicleId) revalidatePath(`/browse/${vehicleId}`);
    return;
  }

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

  const agreedRate = Number(rate.price) || 0;
  const owed = commissionOwed(agreedRate, SHIPPER_COMMISSION_PCT);

  const { error } = await supabase.from("shipment_requests").insert({
    shipper_id: rate.shipper_id,
    shipping_rate_id: rate.rate_id,
    buyer_id: user.id,
    agreed_rate: agreedRate,
    currency: rate.currency ?? "USD",
    commission_pct: SHIPPER_COMMISSION_PCT,
    commission_owed: owed,
    commission_charge_status: "pending",
    status: "pending",
    shipper_details_revealed_at: new Date().toISOString(),
    shipper_company_name: shipper.company_name,
    shipper_contact_name: shipper.contact_name,
    shipper_contact_email: shipper.contact_email,
    shipper_contact_phone: shipper.contact_phone,
  });
  if (error) {
    console.error("selectShippingRate insert failed:", error);
    return;
  }

  if (vehicleId) revalidatePath(`/browse/${vehicleId}`);
  revalidatePath("/buyer/dashboard");
}
