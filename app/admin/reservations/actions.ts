"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin actions for the reservation queue (purchase_requests). Bound to
 * <form action={…}> with a hidden `id` field.
 *
 * middleware.ts gates /admin to role 'admin'; requireAdmin() re-checks here;
 * and the "purchase requests admin update" RLS policy (public.is_admin())
 * enforces it at the database.
 */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return null;

  return supabase;
}

/** Move a fresh request into review. */
export async function markReservationUnderReview(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) return;

  const supabase = await requireAdmin();
  if (!supabase) return;

  await supabase
    .from("purchase_requests")
    .update({ status: "under_review" })
    .eq("id", id)
    .eq("status", "submitted");

  revalidatePath("/admin/reservations");
}

/** Release a reservation — the buyer no longer holds intent on the vehicle. */
export async function releaseReservation(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) return;

  const supabase = await requireAdmin();
  if (!supabase) return;

  // Only release requests that are still open; a status filter keeps a
  // double-submit from clobbering a later state.
  await supabase
    .from("purchase_requests")
    .update({ status: "cancelled" })
    .eq("id", id)
    .in("status", ["submitted", "under_review", "verified"]);

  revalidatePath("/admin/reservations");
}
