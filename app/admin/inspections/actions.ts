"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { assignInspection, decideInspection } from "@/lib/inspection-server";
import { SESSION_ENDED, checkWrite, notSaved, savedWithAudit, type ActionResult } from "@/lib/action-result";

/** Admin actions for inspectors and inspections (0063). All audit-logged. */

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

function revalidateAll() {
  revalidatePath("/admin/inspectors");
  revalidatePath("/admin/reservations");
  revalidatePath("/buyer/dashboard");
  revalidatePath("/seller/reservations");
}

export async function decideInspectorApplication(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = str(formData.get("id"));
  const decision = str(formData.get("decision"));
  if (!id || !["approve", "reject", "suspend"].includes(decision)) return notSaved("the form is incomplete. Reload and try again.");
  const reason = str(formData.get("reason")).slice(0, 1000);
  if (decision !== "approve" && !reason) return notSaved("add a reason the inspector will see.");
  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);
  const status = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "suspended";
  const res = await ctx.supabase
    .from("inspectors")
    .update({ status, rejection_reason: decision === "approve" ? null : reason, reviewed_by: ctx.adminId, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .select("status");
  const bad = checkWrite(res);
  if (bad) return bad;
  if (res.data?.[0]?.status !== status) return notSaved("the change didn't stick. Reload and try again.");
  const audit = await logAdminAction(ctx.supabase, `inspector.${decision}`, { table: "inspectors", id }, decision === "approve" ? {} : { reason });
  revalidateAll();
  return savedWithAudit(`Inspector ${status}.`, audit);
}

export async function assignInspectorAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = str(formData.get("id"));
  if (!id) return notSaved("the form is missing the reservation. Reload and try again.");
  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);
  const result = await assignInspection(id, ctx.adminId);
  if (!result.ok) return notSaved(result.message);
  const audit = await logAdminAction(ctx.supabase, "inspection.assign_random", { table: "inspections", id: result.id ?? null }, { purchase_request_id: id, result: result.message });
  revalidateAll();
  return savedWithAudit(result.message, audit);
}

export async function decideInspectionAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = str(formData.get("id"));
  const decision = str(formData.get("decision"));
  if (!id || (decision !== "pass" && decision !== "fail")) return notSaved("the form is incomplete. Reload and try again.");
  const note = str(formData.get("note")).slice(0, 1000);
  if (decision === "fail" && !note) return notSaved("say why it failed.");
  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);
  const result = await decideInspection({ inspectionId: id, pass: decision === "pass", note, adminId: ctx.adminId });
  if (!result.ok) return notSaved(result.message);
  const audit = await logAdminAction(ctx.supabase, decision === "pass" ? "inspection.pass" : "inspection.fail", { table: "inspections", id }, { pay_usd: result.payUsd ?? null, ...(note ? { note } : {}) });
  revalidateAll();
  revalidatePath(`/admin/inspections/${id}`);
  return savedWithAudit(result.message, audit);
}

export async function markInspectorPaidAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = str(formData.get("id"));
  if (!id) return notSaved("the form is missing the inspection.");
  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);
  const res = await ctx.supabase
    .from("inspections")
    .update({ pay_status: "paid", paid_at: new Date().toISOString(), paid_by: ctx.adminId })
    .eq("id", id)
    .eq("pay_status", "owed")
    .select("pay_status, pay_usd");
  const bad = checkWrite(res, "this pay isn't marked as owed — reload to see it.");
  if (bad) return bad;
  const audit = await logAdminAction(ctx.supabase, "inspection.mark_paid", { table: "inspections", id }, { pay_usd: res.data?.[0]?.pay_usd ?? null });
  revalidatePath(`/admin/inspections/${id}`);
  return savedWithAudit("Marked as paid.", audit);
}
