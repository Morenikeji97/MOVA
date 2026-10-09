"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_ENDED, checkWrite, notSaved, savedWithAudit, type ActionResult } from "@/lib/action-result";
import { anonymizeErrorMessage, isProtectedAccount } from "@/lib/account-deletion";
import { notifyAccountDeleted } from "@/lib/notifications";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

function revalidate() {
  revalidatePath("/admin/account-deletions");
  revalidatePath("/admin/action-required");
}

/**
 * Delete (anonymise) the account behind a pending request: public.anonymize_account
 * (0069, refuses while a deal is in progress), then the login is soft-deleted
 * so it can never sign in. The confirmation goes to the ORIGINAL address,
 * read before it's replaced. Admin with the authenticator code; audit-logged
 * without personal details.
 */
export async function deleteAccountAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = str(formData.get("id"));
  if (!id) return notSaved("the form is missing the request. Reload and try again.");
  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);

  const db = createAdminClient();
  const { data: req } = await db.from("account_deletion_requests").select("id, user_id, status").eq("id", id).maybeSingle();
  if (!req) return notSaved("this request wasn't found.");
  if (req.status !== "pending") return notSaved(`this request is already ${req.status}.`);
  const { data: person } = await db.from("users").select("email, role").eq("id", req.user_id).maybeSingle();
  if (!person) return notSaved("the account wasn't found.");
  if (isProtectedAccount(person.role)) return notSaved("admin accounts can't be deleted here — ask the developer.");
  const originalEmail = person.email;

  const { data: summary, error } = await db.rpc("anonymize_account", { p_user: req.user_id });
  if (error) return notSaved(anonymizeErrorMessage(error.message));

  const { error: authError } = await db.auth.admin.deleteUser(req.user_id, true);
  if (authError) {
    // Details are already cleared; the request stays pending so it can be retried.
    return notSaved(`personal details were cleared, but the sign-in wasn't removed (${authError.message}). Try again.`);
  }

  const done = await ctx.supabase
    .from("account_deletion_requests")
    .update({ status: "completed", processed_by: ctx.adminId, processed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  const bad = checkWrite(done, "the account was deleted, but the request couldn't be marked done — reload.");
  if (bad) return bad;

  const emailed = originalEmail.endsWith("@deleted.shipmova.invalid") ? false : await notifyAccountDeleted(originalEmail);
  const audit = await logAdminAction(ctx.supabase, "account.delete", { table: "users", id: req.user_id }, {
    request_id: id,
    ...(summary ?? {}),
    confirmation_emailed: emailed,
  });
  revalidate();
  return savedWithAudit(`Account deleted${emailed ? " and the person emailed" : " (the confirmation email didn't send)"}.`, audit);
}

/** Refuse a request, with a reason the admin records (e.g. a deal in progress, or not the account holder). */
export async function refuseAccountDeletionAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = str(formData.get("id"));
  const note = str(formData.get("note")).slice(0, 1000);
  if (!id) return notSaved("the form is missing the request. Reload and try again.");
  if (!note) return notSaved("say why.");
  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);
  const res = await ctx.supabase
    .from("account_deletion_requests")
    .update({ status: "refused", note, processed_by: ctx.adminId, processed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("user_id");
  const bad = checkWrite(res, "this request isn't pending any more — reload.");
  if (bad) return bad;
  const audit = await logAdminAction(ctx.supabase, "account.delete_refused", { table: "account_deletion_requests", id }, { note });
  revalidate();
  return savedWithAudit("Refused. Tell the person why (WhatsApp or email).", audit);
}
