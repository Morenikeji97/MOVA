"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { VinVerificationStatus } from "@/types/database";
import { NO_PHOTOS_APPROVAL_MESSAGE, VIN_NOT_VERIFIED_APPROVAL_MESSAGE } from "@/lib/listings-review";
import { requireAdminMfa } from "@/lib/admin-mfa";

const VIN_VERIFICATION_STATUSES: VinVerificationStatus[] = [
  "unverified",
  "checking",
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
  await requireAdminMfa(supabase);

  return { supabase, adminId: user.id };
}

export type ApproveListingResult = { ok: true } | { ok: false; error: string };

/**
 * Approve a listing: pending → approved.
 *
 * A listing with no photos is refused here with a message for the admin
 * page, and by the vehicles_require_photo_to_approve trigger (0044) for any
 * request that skips this check.
 */
export async function approveListing(
  _prev: ApproveListingResult | null,
  formData: FormData,
): Promise<ApproveListingResult> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Something went wrong. Please reload and try again." };
  }

  const ctx = await requireAdmin();
  if (!ctx) return { ok: false, error: "Admins only." };
  const { supabase } = ctx;

  const { count: photoCount } = await supabase
    .from("vehicle_photos")
    .select("id", { count: "exact", head: true })
    .eq("vehicle_id", id);
  if (!photoCount) return { ok: false, error: NO_PHOTOS_APPROVAL_MESSAGE };

  // The VIN check must be 'verified' (0047), not merely "not flagged".
  const { data: vinRow } = await supabase
    .from("vehicles")
    .select("vin_verification_status")
    .eq("id", id)
    .maybeSingle();
  if (vinRow?.vin_verification_status !== "verified") {
    return { ok: false, error: VIN_NOT_VERIFIED_APPROVAL_MESSAGE };
  }

  // The status filter keeps this idempotent: a double-submit updates no rows.
  // The vin_verification_status and title_identity_match_confirmed filters
  // express the same rule as lib/listings-review.ts's canApproveListing()
  // (which drives the Approve button's disabled state), backstopped by the
  // DB CHECK constraints themselves (vehicles_vin_verified_before_approval,
  // vehicles_title_identity_confirmed_before_approval) — a VIN that isn't
  // 'verified' or an unconfirmed title-identity match can't be approved, so
  // this matches zero rows rather than erroring.
  const { error } = await supabase
    .from("vehicles")
    .update({ status: "approved", rejection_reason: null })
    .eq("id", id)
    .eq("status", "pending_review")
    .eq("vin_verification_status", "verified")
    .eq("title_identity_match_confirmed", true);

  if (error) {
    if (error.message.includes("listing_has_no_photos")) {
      return { ok: false, error: NO_PHOTOS_APPROVAL_MESSAGE };
    }
    if (error.message.includes("vehicles_vin_verified_before_approval")) {
      return { ok: false, error: VIN_NOT_VERIFIED_APPROVAL_MESSAGE };
    }
    console.error("approveListing: update failed", error);
    return { ok: false, error: "Could not approve this listing. Please try again." };
  }

  revalidatePath("/admin/listings");
  return { ok: true };
}

/** Reject a listing and record why. A non-empty reason is required. */
export async function rejectListing(formData: FormData): Promise<void> {
  const id = formData.get("id");
  const reasonRaw = formData.get("rejection_reason");
  if (typeof id !== "string" || id.length === 0) return;

  const reason = typeof reasonRaw === "string" ? reasonRaw.trim() : "";
  if (reason.length === 0) return;

  const ctx = await requireAdmin();
  if (!ctx) return;
  const { supabase } = ctx;

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

  const ctx = await requireAdmin();
  if (!ctx) return;
  const { supabase } = ctx;

  await supabase.from("vehicles").update({ vin_verification_status: status }).eq("id", id);

  revalidatePath("/admin/listings");
}

/**
 * Record admin's manual confirmation that the seller's uploaded title (and,
 * for a not-titled-owner seller, their authorization document) names match
 * their Stripe-Identity-verified name. A DB trigger
 * (vehicles_guard_admin_only_fields) additionally keeps this column and its
 * audit pair admin-only regardless of who calls the update, and a CHECK
 * constraint (vehicles_title_identity_confirmed_before_approval) blocks
 * approval while it's false. confirmed_by/confirmed_at are cleared (not
 * just left stale) when un-confirming, since a null pair unambiguously
 * means "not currently confirmed" rather than "confirmed once, by someone,
 * at some point" — same reasoning bank-transfer rejection clears the prior
 * review fields (0014) rather than leaving them pointing at an outcome that
 * no longer holds.
 */
export async function setTitleIdentityMatchConfirmed(formData: FormData): Promise<void> {
  const id = formData.get("id");
  const confirmed = formData.get("title_identity_match_confirmed") === "true";
  if (typeof id !== "string" || id.length === 0) return;

  const ctx = await requireAdmin();
  if (!ctx) return;
  const { supabase, adminId } = ctx;

  // A confirmation is only meaningful against a document that exists. The
  // admin UI already disables the checkbox until one does
  // (documentsReady in review-actions.tsx) and the DB refuses the row outright
  // (vehicles_title_confirmation_requires_document, 0032) — this makes a
  // hand-crafted POST a clean no-op instead of a raw constraint error, and
  // keeps the three layers stating the same rule.
  if (confirmed) {
    const { data: docs } = await supabase
      .from("vehicles")
      .select("has_title_document, not_titled_owner, has_authorization_document")
      .eq("id", id)
      .maybeSingle();
    if (!docs) return;
    const hasDocument =
      docs.has_title_document ||
      (docs.not_titled_owner && docs.has_authorization_document);
    if (!hasDocument) return;
  }

  await supabase
    .from("vehicles")
    .update({
      title_identity_match_confirmed: confirmed,
      title_identity_match_confirmed_by: confirmed ? adminId : null,
      title_identity_match_confirmed_at: confirmed ? new Date().toISOString() : null,
    })
    .eq("id", id);

  revalidatePath("/admin/listings");
}
