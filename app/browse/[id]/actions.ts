"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Buyer "Reserve this vehicle" action from /browse/[id].
 *
 * "Intent only": this records a purchase_requests row in 'submitted' for the
 * buyer. The vehicle stays 'approved' and visible, and other buyers can still
 * reserve it — an admin sorts out who proceeds. There's no auto-expiry; an
 * admin releases a request from /admin/reservations.
 *
 * RLS already scopes this: "purchase requests buyer insert" requires
 * buyer_id = auth.uid(), and buyers can only read their own rows.
 */
export async function reserveVehicle(formData: FormData): Promise<void> {
  const vehicleId = formData.get("vehicleId");
  if (typeof vehicleId !== "string" || vehicleId.length === 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Buyers only.
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "buyer") return;

  // The vehicle must exist and be live.
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("status", "approved")
    .maybeSingle();
  if (!vehicle) return;

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
  if (existing) return;

  await supabase.from("purchase_requests").insert({
    vehicle_id: vehicleId,
    buyer_id: user.id,
    status: "submitted",
  });

  revalidatePath(`/browse/${vehicleId}`);
  revalidatePath("/admin/reservations");
}
