"use server";

import { revalidatePath } from "next/cache";
import { notifyDisputeDecision } from "@/lib/notifications";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import {
  SESSION_ENDED,
  checkWrite,
  notSaved,
  savedWithAudit,
  type ActionResult,
} from "@/lib/action-result";

/**
 * Admin actions for the dispute queue. Bound to <ActionForm action={…}>
 * with a hidden `id` field; each reports "Saved…" only once the write is
 * confirmed, or "Not saved: <reason>", and writes the admin audit log.
 * Same three-layer gate as every other admin action: middleware.ts,
 * requireAdmin() (lib/admin-auth.ts), and the "disputes admin update" RLS
 * policy (public.is_admin()).
 *
 * None of this calls Stripe or moves money — it only records a decision.
 * Real refunds happen manually (Stripe dashboard, or a manual bank transfer
 * for bank-transfer payments); "Mark refund completed" below is purely
 * record-keeping after that's done outside the app.
 */

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

const MISSING_ID = "the form is missing the dispute. Reload and try again.";
const NOT_OPEN = "this dispute was already decided — reload to see its current state.";

function revalidateDisputes() {
  revalidatePath("/admin/disputes");
  revalidatePath("/buyer/dashboard");
  revalidatePath("/seller/reservations");
}

/** Approve a dispute for refund — records the decision only, no Stripe call. */
export async function approveDisputeForRefund(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = str(formData.get("id"));
  const reason = str(formData.get("decision_reason"));
  const amountRaw = str(formData.get("decision_amount_usd"));
  if (!id) return notSaved(MISSING_ID);
  if (!reason) return notSaved("add a reason — it's shown to whoever filed the dispute.");

  const amount = amountRaw.length > 0 ? Number(amountRaw) : null;
  if (amount != null && (!Number.isFinite(amount) || amount < 0)) {
    return notSaved("the refund amount must be a number of dollars, 0 or more.");
  }

  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);

  const res = await ctx.supabase
    .from("disputes")
    .update({
      status: "approved_pending_refund",
      decided_by: ctx.adminId,
      decision_reason: reason,
      decision_amount_usd: amount,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "open")
    .select("id");
  const bad = checkWrite(res, NOT_OPEN);
  if (bad) return bad;

  const audit = await logAdminAction(ctx.supabase, "dispute.approve_refund", { table: "disputes", id }, {
    reason,
    amount_usd: amount,
  });
  revalidateDisputes();
  await notifyDisputeDecision(id);
  return savedWithAudit("Approved for refund — both parties were emailed.", audit);
}

/** Deny a dispute — a reason is required, since it's shown to whoever filed it. */
export async function denyDispute(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = str(formData.get("id"));
  const reason = str(formData.get("decision_reason"));
  if (!id) return notSaved(MISSING_ID);
  if (!reason) return notSaved("add a reason — it's shown to whoever filed the dispute.");

  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);

  const res = await ctx.supabase
    .from("disputes")
    .update({
      status: "denied",
      decided_by: ctx.adminId,
      decision_reason: reason,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "open")
    .select("id");
  const bad = checkWrite(res, NOT_OPEN);
  if (bad) return bad;

  const audit = await logAdminAction(ctx.supabase, "dispute.deny", { table: "disputes", id }, { reason });
  revalidateDisputes();
  await notifyDisputeDecision(id);
  return savedWithAudit("Dispute denied — both parties were emailed.", audit);
}

/**
 * Record-keeping only: marks a refund ShipMova already processed manually
 * (Stripe dashboard, or a manual bank transfer) as completed. Only reachable
 * from 'approved_pending_refund' — a denied dispute has nothing to complete.
 */
export async function markRefundCompleted(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = str(formData.get("id"));
  if (!id) return notSaved(MISSING_ID);

  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);

  const res = await ctx.supabase
    .from("disputes")
    .update({ status: "refund_completed", refund_completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "approved_pending_refund")
    .select("id");
  const bad = checkWrite(res, "this dispute isn't waiting on a refund — reload to see its current state.");
  if (bad) return bad;

  const audit = await logAdminAction(ctx.supabase, "dispute.refund_completed", { table: "disputes", id });
  revalidateDisputes();
  return savedWithAudit("Refund marked completed.", audit);
}
