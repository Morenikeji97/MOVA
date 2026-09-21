"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ReferralPayoutStatus } from "@/types/database";

/**
 * Admin actions for /admin/referrals. Bound to <form action={…}> with hidden
 * fields. middleware.ts gates /admin to role 'admin'; requireAdmin() re-checks
 * here; the "referral credits admin review update" / "referral payout
 * batches admin update" RLS policies (public.is_admin()) enforce it at the
 * database — both are plain admin-only row policies, no column-level guard
 * needed since only an admin can reach these rows' UPDATE at all.
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

  return { supabase, adminId: user.id };
}

/** Clears a flagged referral credit's rate-flag review without changing its outcome. */
export async function markReferralFlagReviewed(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) return;

  const ctx = await requireAdmin();
  if (!ctx) return;

  await ctx.supabase
    .from("referral_credits")
    .update({ flag_reviewed_by: ctx.adminId, flag_reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("flag_status", "flagged");

  revalidatePath("/admin/referrals");
}

/**
 * Admin confirms (or fails) a $1,000 payout batch — this codebase has no
 * outbound Stripe Connect/transfer infrastructure (see migration 0030's
 * header comment), so the actual money movement (a manual Stripe transfer
 * for a US-based referrer, a bank wire otherwise) happens outside this
 * action; this just records the outcome for the ledger.
 */
export async function updateReferralPayoutStatus(formData: FormData): Promise<void> {
  const id = formData.get("id");
  const status = formData.get("status");
  if (typeof id !== "string" || id.length === 0) return;
  if (status !== "processing" && status !== "paid" && status !== "failed") return;

  const ctx = await requireAdmin();
  if (!ctx) return;

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

  await ctx.supabase.from("referral_payout_batches").update(update).eq("id", id);

  revalidatePath("/admin/referrals");
}
