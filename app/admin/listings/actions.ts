"use server";

import { revalidatePath } from "next/cache";
import type { VinVerificationStatus } from "@/types/database";
import { NO_PHOTOS_APPROVAL_MESSAGE, VIN_NOT_VERIFIED_APPROVAL_MESSAGE } from "@/lib/listings-review";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import {
  SESSION_ENDED,
  checkWrite,
  notSaved,
  savedWithAudit,
  type ActionResult,
} from "@/lib/action-result";
import { notifyListingDecision } from "@/lib/notifications";

const VIN_VERIFICATION_STATUSES: VinVerificationStatus[] = [
  "unverified",
  "checking",
  "verified",
  "flagged",
];

const MISSING_ID = "the form is missing the listing. Reload and try again.";

/**
 * Approve a listing: pending → approved. Every condition is checked here so
 * the admin is told exactly why it can't be approved yet; the status /
 * VIN / title filters on the update and the DB CHECK constraints back that
 * up, and a confirmed write is required before "Approved" is shown.
 */
export async function approveListing(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) return notSaved(MISSING_ID);

  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);
  const { supabase } = ctx;

  const { count: photoCount } = await supabase
    .from("vehicle_photos")
    .select("id", { count: "exact", head: true })
    .eq("vehicle_id", id);
  if (!photoCount) return notSaved(NO_PHOTOS_APPROVAL_MESSAGE);

  const { data: row } = await supabase
    .from("vehicles")
    .select("status, vin_verification_status, title_identity_match_confirmed")
    .eq("id", id)
    .maybeSingle();
  if (!row) return notSaved("this listing wasn't found.");
  if (row.status !== "pending_review") return notSaved(`it's ${row.status.replace("_", " ")}, not waiting for review.`);
  // The VIN check must be 'verified' (0047), not merely "not flagged".
  if (row.vin_verification_status !== "verified") return notSaved(VIN_NOT_VERIFIED_APPROVAL_MESSAGE);
  if (!row.title_identity_match_confirmed) return notSaved("confirm the title matches the seller's verified identity first.");

  const res = await supabase
    .from("vehicles")
    .update({ status: "approved", rejection_reason: null })
    .eq("id", id)
    .eq("status", "pending_review")
    .eq("vin_verification_status", "verified")
    .eq("title_identity_match_confirmed", true)
    .select("id");
  if (res.error) {
    if (res.error.message.includes("listing_has_no_photos")) return notSaved(NO_PHOTOS_APPROVAL_MESSAGE);
    if (res.error.message.includes("vehicles_vin_verified_before_approval")) {
      return notSaved(VIN_NOT_VERIFIED_APPROVAL_MESSAGE);
    }
    console.error("approveListing: update failed", res.error);
  }
  const bad = checkWrite(res, "it changed meanwhile — reload to see its current state.");
  if (bad) return bad;

  const audit = await logAdminAction(supabase, "listing.approve", { table: "vehicles", id });
  await notifyListingDecision(id, true, null);
  revalidatePath("/admin/listings");
  return savedWithAudit("Approved — the listing is live.", audit);
}

/** Reject a listing and record why. A non-empty reason is required. */
export async function rejectListing(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) return notSaved(MISSING_ID);
  const reasonRaw = formData.get("rejection_reason");
  const reason = typeof reasonRaw === "string" ? reasonRaw.trim() : "";
  if (reason.length === 0) return notSaved("add a reason the seller will see.");

  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);

  const res = await ctx.supabase
    .from("vehicles")
    .update({ status: "rejected", rejection_reason: reason })
    .eq("id", id)
    .eq("status", "pending_review")
    .select("id");
  const bad = checkWrite(res, "it's no longer waiting for review — reload to see its current state.");
  if (bad) return bad;

  const audit = await logAdminAction(ctx.supabase, "listing.reject", { table: "vehicles", id }, { reason });
  await notifyListingDecision(id, false, reason);
  revalidatePath("/admin/listings");
  return savedWithAudit("Rejected — the seller sees your reason.", audit);
}

/**
 * Record the outcome of the admin's own manual NICB VINCheck / NMVTIS lookup
 * (run outside the app — there's no live API integration yet). A DB trigger
 * (vehicles_guard_admin_only_fields) additionally keeps this column
 * admin-only regardless of who calls the update.
 */
export async function setVinVerificationStatus(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = formData.get("id");
  const statusRaw = formData.get("vin_verification_status");
  if (typeof id !== "string" || id.length === 0) return notSaved(MISSING_ID);
  const status = statusRaw as VinVerificationStatus;
  if (typeof statusRaw !== "string" || !VIN_VERIFICATION_STATUSES.includes(status)) {
    return notSaved("unknown VIN check result.");
  }

  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);

  const res = await ctx.supabase
    .from("vehicles")
    .update({ vin_verification_status: status })
    .eq("id", id)
    .select("vin_verification_status");
  const bad = checkWrite(res, "this listing wasn't found.");
  if (bad) return bad;
  if ((res.data?.[0] as { vin_verification_status?: string } | undefined)?.vin_verification_status !== status) {
    return notSaved("the database kept the previous VIN result.");
  }

  const audit = await logAdminAction(ctx.supabase, "listing.set_vin_status", { table: "vehicles", id }, { status });
  revalidatePath("/admin/listings");
  return savedWithAudit(`VIN check saved: ${status}.`, audit);
}

/**
 * Record admin's manual confirmation that the seller's uploaded title (and,
 * for a not-titled-owner seller, their authorization document) names match
 * their Stripe-Identity-verified name. A DB trigger
 * (vehicles_guard_admin_only_fields) keeps this column and its audit pair
 * admin-only, and a CHECK constraint
 * (vehicles_title_identity_confirmed_before_approval) blocks approval while
 * it's false. confirmed_by/confirmed_at are cleared when un-confirming, so a
 * null pair unambiguously means "not currently confirmed".
 */
export async function setTitleIdentityMatchConfirmed(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = formData.get("id");
  const confirmed = formData.get("title_identity_match_confirmed") === "true";
  if (typeof id !== "string" || id.length === 0) return notSaved(MISSING_ID);

  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);
  const { supabase, adminId } = ctx;

  // A confirmation is only meaningful against a document that exists (the DB
  // also refuses it: vehicles_title_confirmation_requires_document, 0032).
  if (confirmed) {
    const { data: docs } = await supabase
      .from("vehicles")
      .select("has_title_document, not_titled_owner, has_authorization_document")
      .eq("id", id)
      .maybeSingle();
    if (!docs) return notSaved("this listing wasn't found.");
    const hasDocument =
      docs.has_title_document || (docs.not_titled_owner && docs.has_authorization_document);
    if (!hasDocument) return notSaved("there's no title (or authorization) document to confirm yet.");
  }

  const res = await supabase
    .from("vehicles")
    .update({
      title_identity_match_confirmed: confirmed,
      title_identity_match_confirmed_by: confirmed ? adminId : null,
      title_identity_match_confirmed_at: confirmed ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select("title_identity_match_confirmed");
  const bad = checkWrite(res, "this listing wasn't found.");
  if (bad) return bad;
  if ((res.data?.[0] as { title_identity_match_confirmed?: boolean } | undefined)?.title_identity_match_confirmed !== confirmed) {
    return notSaved("the database kept the previous value.");
  }

  const audit = await logAdminAction(
    supabase,
    confirmed ? "listing.confirm_title" : "listing.unconfirm_title",
    { table: "vehicles", id },
  );
  revalidatePath("/admin/listings");
  return savedWithAudit(confirmed ? "Title match confirmed." : "Title confirmation removed.", audit);
}
