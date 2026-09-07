"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { feeBreakdown } from "@/lib/fees";

/**
 * Outcome of {@link reserveVehicle}. `ok: true, created: false` means the buyer
 * already had an open request for this vehicle (nothing new was written).
 */
export type ReserveResult =
  | { ok: true; created: boolean }
  | { ok: false; error: string };

/**
 * Buyer "Reserve this vehicle" action from /browse/[id].
 *
 * "Intent only": records a purchase_requests row in 'submitted' for the buyer.
 * The vehicle stays 'approved' and visible, and other buyers can still reserve
 * it — an admin sorts out who proceeds from /admin/reservations.
 *
 * RLS scopes this: "purchase requests buyer insert" requires
 * buyer_id = auth.uid(), and buyers can only read their own rows.
 *
 * Returns a {@link ReserveResult} so the form can tell "sent", "you already
 * have a request", and "it failed" apart — the insert error is no longer
 * swallowed.
 */
export async function reserveVehicle(
  _prev: ReserveResult | null,
  formData: FormData,
): Promise<ReserveResult> {
  const vehicleId = formData.get("vehicleId");
  if (typeof vehicleId !== "string" || vehicleId.length === 0) {
    return { ok: false, error: "Something went wrong. Please reload and try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Please sign in with a buyer account to reserve." };
  }

  // Buyers only.
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "buyer") {
    return { ok: false, error: "Reserving is for buyer accounts." };
  }

  // The vehicle must exist and be live.
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, price_usd, fee_responsibility")
    .eq("id", vehicleId)
    .eq("status", "approved")
    .maybeSingle();
  if (!vehicle) {
    return { ok: false, error: "This vehicle is no longer available to reserve." };
  }

  // One open request per buyer + vehicle. A previously cancelled/rejected
  // request doesn't block a fresh one.
  const { data: existing } = await supabase
    .from("purchase_requests")
    .select("id")
    .eq("vehicle_id", vehicleId)
    .eq("buyer_id", user.id)
    .not("status", "in", "(cancelled,rejected)")
    .limit(1)
    .maybeSingle();
  if (existing) return { ok: true, created: false };

  // Snapshot the price and the full 8% fee at reservation time — the listing
  // price can change later, but this reservation is priced from now.
  const price = Number(vehicle.price_usd);
  const { fullFee } = feeBreakdown(price, vehicle.fee_responsibility);

  const { error } = await supabase.from("purchase_requests").insert({
    vehicle_id: vehicleId,
    buyer_id: user.id,
    status: "submitted",
    vehicle_price_usd: price,
    mova_fee_usd: fullFee,
  });
  if (error) {
    // Previously swallowed: a failed insert left the UI showing success.
    console.error("reserveVehicle: purchase_requests insert failed", error);
    return {
      ok: false,
      error: "We couldn't send your reservation request just now. Please try again.",
    };
  }

  revalidatePath(`/browse/${vehicleId}`);
  revalidatePath("/admin/reservations");
  revalidatePath("/admin/dashboard");
  return { ok: true, created: true };
}
