"use server";

import { revalidatePath } from "next/cache";
import type { ReferralPayoutStatus } from "@/types/database";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { SESSION_ENDED, checkWrite, notSaved, savedWithAudit, type ActionResult } from "@/lib/action-result";

/**
 * Admin actions for /admin/referrals. Bound to <form action={…}> with hidden
 * fields. middleware.ts gates /admin to role 'admin'; requireAdmin() re-checks
 * here; the "referral credits admin review update" / "referral payout
 * batches admin update" RLS policies (public.is_admin()) enforce it at the
 * database — both are plain admin-only row policies, no column-level guard
 * needed since only an admin can reach these rows' UPDATE at all.
 */

/** Clears a flagged referral credit's rate-flag review without changing its outcome. */
export async function markReferralFlagReviewed(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) return notSaved("the form is missing the referral. Reload and try again.");

  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);

  const res = await ctx.supabase
    .from("referral_credits")
    .update({ flag_reviewed_by: ctx.adminId, flag_reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("flag_status", "flagged")
    .select("id");
  const bad = checkWrite(res, "this referral isn't flagged any more — reload to see it.");
  if (bad) return bad;

  const audit = await logAdminAction(ctx.supabase, "referral.flag_reviewed", { table: "referral_credits", id });
  revalidatePath("/admin/referrals");
  return savedWithAudit("Marked reviewed.", audit);
}

/**
 * Admin confirms (or fails) a $1,000 payout batch — this codebase has no
 * outbound Stripe Connect/transfer infrastructure (see migration 0030's
 * header comment), so the actual money movement (a manual Stripe transfer
 * for a US-based referrer, a bank wire otherwise) happens outside this
 * action; this just records the outcome for the ledger.
 */
export async function updateReferralPayoutStatus(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = formData.get("id");
  const status = formData.get("status");
  if (typeof id !== "string" || id.length === 0) return notSaved("the form is missing the payout. Reload and try again.");
  if (status !== "processing" && status !== "paid" && status !== "failed") return notSaved("unknown payout status.");

  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);

  const payoutReference = formData.get("payout_reference");
  const failureReason = formData.get("failure_reason");

  const update: {
    status: ReferralPayoutStatus;
    reviewed_by: string;
    reviewed_at: string;
    payout_reference?: string | null;
    failure_reason?: string | null;
    paid_at?: string;
  } = {
    status,
    reviewed_by: ctx.adminId,
    reviewed_at: new Date().toISOString(),
  };
  if (typeof payoutReference === "string" && payoutReference.trim()) {
    update.payout_reference = payoutReference.trim();
  }
  if (status === "failed") {
    update.failure_reason =
      typeof failureReason === "string" && failureReason.trim()
        ? failureReason.trim()
        : "Not specified";
  }
  if (status === "paid") {
    update.paid_at = new Date().toISOString();
  }

  const res = await ctx.supabase.from("referral_payout_batches").update(update).eq("id", id).select("id");
  const bad = checkWrite(res, "this payout wasn't found.");
  if (bad) return bad;

  const audit = await logAdminAction(ctx.supabase, `referral.payout_${status}`, {
    table: "referral_payout_batches",
    id,
  }, { payout_reference: update.payout_reference ?? null, failure_reason: update.failure_reason ?? null });
  revalidatePath("/admin/referrals");
  return savedWithAudit(`Payout marked ${status}.`, audit);
}
