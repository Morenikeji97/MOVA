"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { notifyBuyerIdDecision } from "@/lib/notifications";
import { SESSION_ENDED, notSaved, saved, type ActionResult } from "@/lib/action-result";
import { BUYER_ID_BUCKET } from "@/lib/id-verification";

/**
 * Decide a buyer ID that needs review (name mismatch, or a Togo/Benin ID
 * photo). After the decision is saved, the ID photo is deleted from Storage
 * and its path cleared — ShipMova keeps only the decision, its date and who
 * made it (buyer_profiles.id_reviewed_*, and the admin audit log).
 */

async function decide(formData: FormData, approve: boolean): Promise<ActionResult> {
  const buyerId = formData.get("buyer_id");
  if (typeof buyerId !== "string" || buyerId.length === 0) {
    return notSaved("the form is missing the buyer. Reload and try again.");
  }
  const noteRaw = formData.get("note");
  const note = typeof noteRaw === "string" ? noteRaw.trim().slice(0, 1000) : "";
  if (!approve && !note) return notSaved("add a reason the buyer will see.");

  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);

  const { data: before } = await ctx.supabase
    .from("buyer_profiles")
    .select("verification_status, id_method, id_country, id_document_path")
    .eq("user_id", buyerId)
    .maybeSingle();
  if (!before) return notSaved("this buyer wasn't found.");
  if (before.verification_status !== "pending") {
    return notSaved("this ID was already decided — reload to see it.");
  }

  const now = new Date().toISOString();
  // 1. The decision (the photo's path is cleared in the same write).
  const res = await ctx.supabase
    .from("buyer_profiles")
    .update({
      verification_status: approve ? "verified" : "unverified",
      ...(before.id_method === "ng_nin" ? { nin_verification_status: approve ? "verified" : "unverified" } : {}),
      id_verified_at: approve ? now : null,
      id_reviewed_by: ctx.adminId,
      id_reviewed_at: now,
      id_review_note: approve ? null : note,
      id_document_path: null,
      id_record_name: null,
    })
    .eq("user_id", buyerId)
    .eq("verification_status", "pending")
    .select("verification_status, id_document_path");
  if (res.error) return notSaved(res.error.message);
  const row = res.data?.[0];
  if (!row || row.verification_status !== (approve ? "verified" : "unverified") || row.id_document_path !== null) {
    return notSaved("the decision didn't save. Reload and try again.");
  }

  // 2. Delete the ID photo. Only the service role can touch this bucket.
  const hadPhoto = Boolean(before.id_document_path);
  let photoDeleted = true;
  if (before.id_document_path) {
    const { error } = await createAdminClient().storage.from(BUYER_ID_BUCKET).remove([before.id_document_path]);
    if (error) {
      console.error("buyer ID photo delete failed:", error);
      photoDeleted = false;
    }
  }

  // 3. The audit entry: decision, when (created_at) and who (the session).
  const audit = await logAdminAction(
    ctx.supabase,
    approve ? "buyer_id.approve" : "buyer_id.reject",
    { table: "buyer_profiles", id: buyerId },
    {
      method: before.id_method,
      country: before.id_country,
      photo_deleted: hadPhoto ? photoDeleted : null,
      ...(approve ? {} : { reason: note }),
    },
  );

  revalidatePath("/admin/buyer-ids");
  revalidatePath("/admin/dashboard");
  await notifyBuyerIdDecision(buyerId, approve, approve ? null : note);

  const warnings = [
    photoDeleted ? null : "the ID photo couldn't be deleted — tell the developer",
    audit ? `the audit log entry failed (${audit}) — tell the developer` : null,
  ].filter(Boolean);
  const base = approve ? "Approved — the buyer's account is open." : "Rejected — the buyer sees your reason and can try again.";
  return warnings.length ? { ok: true, message: `${base} Warning: ${warnings.join("; ")}.` } : saved(base);
}

export async function approveBuyerId(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return decide(formData, true);
}

export async function rejectBuyerId(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return decide(formData, false);
}
