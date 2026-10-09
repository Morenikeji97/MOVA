"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SHIPPER_INSURANCE_BUCKET, daysUntil, isoDay } from "@/lib/shipper-verification";
import { notifyShipperCoiSubmitted } from "@/lib/notifications";
import { SESSION_ENDED, notSaved, saved, type ActionResult } from "@/lib/action-result";

/**
 * A shipper sends their marine-cargo insurance certificate (COI) for review.
 * The file is already in the private shipper-insurance-documents bucket
 * (uploaded from the browser into the account's own folder). The service
 * role records it — shippers can't set coi_* themselves (owner guard, 0060).
 * A replaced certificate file is deleted.
 */
export async function submitShipperCoi(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return notSaved(SESSION_ENDED);

  const { data: shipper } = await supabase
    .from("shippers")
    .select("id, status, coi_document_path")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!shipper || (shipper.status !== "pending" && shipper.status !== "approved")) {
    return notSaved("no open shipper account is linked to this login.");
  }

  const path = formData.get("document_path");
  if (typeof path !== "string" || !path.startsWith(`${user.id}/`)) {
    return notSaved("upload your insurance certificate first.");
  }
  const insurerRaw = formData.get("insurer");
  const insurer = typeof insurerRaw === "string" ? insurerRaw.trim() : "";
  if (insurer.length < 2 || insurer.length > 200) return notSaved("enter the insurance company's name.");
  const limit = Number(String(formData.get("cargo_limit_usd") ?? "").replace(/[,\s$]/g, ""));
  if (!Number.isFinite(limit) || limit <= 0 || limit > 100_000_000) {
    return notSaved("enter the cargo cover limit in US dollars, e.g. 50000.");
  }
  const expiresOn = formData.get("expires_on");
  if (typeof expiresOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) {
    return notSaved("enter the date the certificate expires.");
  }
  if (daysUntil(expiresOn, isoDay(new Date())) < 0) {
    return notSaved("this certificate has already expired — upload your current one.");
  }

  const admin = createAdminClient();
  const res = await admin
    .from("shippers")
    .update({
      coi_status: "pending",
      coi_document_path: path,
      coi_insurer: insurer,
      coi_cargo_limit_usd: limit,
      coi_expires_on: expiresOn,
      coi_submitted_at: new Date().toISOString(),
      coi_reviewed_by: null,
      coi_reviewed_at: null,
      coi_review_note: null,
      coi_reminder_stage: null,
    })
    .eq("id", shipper.id)
    .select("coi_status, coi_document_path");
  if (res.error) return notSaved(res.error.message);
  if (res.data?.[0]?.coi_document_path !== path) return notSaved("your certificate couldn't be recorded. Try again.");

  if (shipper.coi_document_path && shipper.coi_document_path !== path) {
    const { error } = await admin.storage.from(SHIPPER_INSURANCE_BUCKET).remove([shipper.coi_document_path]);
    if (error) console.error("earlier COI delete failed:", error);
  }

  revalidatePath("/shipper/portal");
  revalidatePath("/admin/shippers");
  await notifyShipperCoiSubmitted(shipper.id);
  return saved("Certificate sent — ShipMova will check it, usually within a day.");
}
