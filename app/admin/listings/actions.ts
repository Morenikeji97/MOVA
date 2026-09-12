"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { VinVerificationStatus } from "@/types/database";

const VIN_VERIFICATION_STATUSES: VinVerificationStatus[] = [
  "unverified",
  "verified",
  "flagged",
];

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
  // The vin_verification_status filter is a second backstop alongside the DB
  // CHECK constraint (vehicles_flagged_not_approved) — a flagged VIN can't be
  // approved, so this matches zero rows rather than erroring.
  await supabase
    .from("vehicles")
    .update({ status: "approved", rejection_reason: null })
    .eq("id", id)
    .eq("status", "pending_review")
    .neq("vin_verification_status", "flagged");

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

/**
 * Record the outcome of the admin's own manual NICB VINCheck / NMVTIS lookup
 * (run outside the app — there's no live API integration yet). A DB trigger
 * (vehicles_guard_admin_only_fields) additionally keeps this column
 * admin-only regardless of who calls the update.
 */
export async function setVinVerificationStatus(formData: FormData): Promise<void> {
  const id = formData.get("id");
  const statusRaw = formData.get("vin_verification_status");
  if (typeof id !== "string" || id.length === 0) return;
  if (typeof statusRaw !== "string") return;

  const status = statusRaw as VinVerificationStatus;
  if (!VIN_VERIFICATION_STATUSES.includes(status)) return;

  const supabase = await requireAdmin();
  if (!supabase) return;

  await supabase.from("vehicles").update({ vin_verification_status: status }).eq("id", id);

  revalidatePath("/admin/listings");
}
