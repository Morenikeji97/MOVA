"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin actions for the dispute queue. Bound to <form action={…}> with a
 * hidden `id` field. Same three-layer gate as every other admin action in
 * this codebase: middleware.ts restricts /admin to role 'admin',
 * requireAdmin() re-checks here, and the "disputes admin update" RLS policy
 * (public.is_admin(), no exceptions for buyer/seller at any column) enforces
 * it at the database regardless of what this file does.
 *
 * None of this calls Stripe or moves money — it only records a decision.
 * Real refunds happen manually (Stripe dashboard, or a manual bank transfer
 * for bank-transfer payments); "Mark refund completed" below is purely
 * record-keeping after that's done outside the app.
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

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Approve a dispute for refund — records the decision only, no Stripe call. */
export async function approveDisputeForRefund(formData: FormData): Promise<void> {
  const id = str(formData.get("id"));
  const reason = str(formData.get("decision_reason"));
  const amountRaw = str(formData.get("decision_amount_usd"));
  if (!id || !reason) return;

  const amount = amountRaw.length > 0 ? Number(amountRaw) : null;
  if (amount != null && (!Number.isFinite(amount) || amount < 0)) return;

  const ctx = await requireAdmin();
  if (!ctx) return;

  await ctx.supabase
    .from("disputes")
    .update({
      status: "approved_pending_refund",
      decided_by: ctx.adminId,
      decision_reason: reason,
      decision_amount_usd: amount,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "open");

  revalidatePath("/admin/disputes");
  revalidatePath("/buyer/dashboard");
  revalidatePath("/seller/reservations");
}

/** Deny a dispute — a reason is required, since it's shown to whoever filed it. */
export async function denyDispute(formData: FormData): Promise<void> {
  const id = str(formData.get("id"));
  const reason = str(formData.get("decision_reason"));
  if (!id || !reason) return;

  const ctx = await requireAdmin();
  if (!ctx) return;

  await ctx.supabase
    .from("disputes")
    .update({
      status: "denied",
      decided_by: ctx.adminId,
      decision_reason: reason,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "open");

  revalidatePath("/admin/disputes");
  revalidatePath("/buyer/dashboard");
  revalidatePath("/seller/reservations");
}

/**
 * Record-keeping only: marks a refund MOVA already processed manually
 * (Stripe dashboard, or a manual bank transfer) as completed. Only reachable
 * from 'approved_pending_refund' — a denied dispute has nothing to complete.
 */
export async function markRefundCompleted(formData: FormData): Promise<void> {
  const id = str(formData.get("id"));
  if (!id) return;

  const ctx = await requireAdmin();
  if (!ctx) return;

  await ctx.supabase
    .from("disputes")
    .update({ status: "refund_completed", refund_completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "approved_pending_refund");

  revalidatePath("/admin/disputes");
  revalidatePath("/buyer/dashboard");
  revalidatePath("/seller/reservations");
}
