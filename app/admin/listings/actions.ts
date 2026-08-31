"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin review actions for the pending-review queue. Each is bound to a
 * <form action={…}> with a hidden `id` field.
 *
 * Access is enforced in two places: middleware.ts restricts every /admin
 * route to role 'admin' (same ROLE_PREFIXES pattern as /seller and /buyer),
 * and the "vehicles seller update own" RLS policy also allows
 * public.is_admin(), so the UPDATE can't move a listing for a non-admin
 * session even if a request reached this far. requireAdmin() is a cheap
 * belt-and-braces check on top of both.
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

/** Approve a listing: draft/pending → approved. */
export async function approveListing(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) return;

  const supabase = await requireAdmin();
  if (!supabase) return;

  // The status filter keeps this idempotent: a double-submit updates no rows.
  await supabase
    .from("vehicles")
    .update({ status: "approved", rejection_reason: null })
    .eq("id", id)
    .eq("status", "pending_review");

  revalidatePath("/admin/listings");
}

/** Reject a listing and record why. A non-empty reason is required. */
export async function rejectListing(formData: FormData): Promise<void> {
  const id = formData.get("id");
  const reasonRaw = formData.get("rejection_reason");
  if (typeof id !== "string" || id.length === 0) return;

  const reason = typeof reasonRaw === "string" ? reasonRaw.trim() : "";
  if (reason.length === 0) return;

  const supabase = await requireAdmin();
  if (!supabase) return;

  await supabase
    .from("vehicles")
    .update({ status: "rejected", rejection_reason: reason })
    .eq("id", id)
    .eq("status", "pending_review");

  revalidatePath("/admin/listings");
}
