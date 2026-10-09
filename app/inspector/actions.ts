"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { US_STATES } from "@/lib/us-states";
import { approvedInspectorFor, recordInspectionPhoto, submitInspectionReport } from "@/lib/inspection-server";
import { notifyInspectorApplication } from "@/lib/notifications";
import { SESSION_ENDED, notSaved, saved, type ActionResult } from "@/lib/action-result";

/** Inspector-side actions. Inspectors use ordinary logins; see migration 0063. */

async function signedInUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

const STATE_CODES = new Set(US_STATES.map(([code]) => code));

export async function applyAsInspector(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await signedInUser();
  if (!ctx) return notSaved(SESSION_ENDED);
  const name = String(formData.get("full_name") ?? "").replace(/\s+/g, " ").trim();
  if (name.length < 3 || name.length > 200) return notSaved("enter your full name.");
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 40);
  if (phone.replace(/\D/g, "").length < 10) return notSaved("enter a phone number we can reach you on.");
  const states = formData.getAll("service_states").map(String).filter((s) => STATE_CODES.has(s));
  if (states.length === 0) return notSaved("choose at least one state you can inspect in.");

  // The insert guard (0063) forces pending/unreviewed whatever is sent.
  const res = await ctx.supabase
    .from("inspectors")
    .insert({ user_id: ctx.user.id, full_name: name, phone, service_states: states })
    .select("status")
    .single();
  if (res.error) {
    return notSaved(res.error.code === "23505" ? "you've already applied." : res.error.message);
  }
  if (res.data?.status !== "pending") return notSaved("your application couldn't be saved. Try again.");
  revalidatePath("/inspector");
  revalidatePath("/admin/inspectors");
  await notifyInspectorApplication(name);
  return saved("Application sent — ShipMova will review it.");
}

export async function addInspectionPhoto(formData: FormData): Promise<ActionResult> {
  const ctx = await signedInUser();
  if (!ctx) return notSaved(SESSION_ENDED);
  const inspector = await approvedInspectorFor(ctx.user.id);
  if (!inspector) return notSaved("you're not an approved inspector.");
  const kind = String(formData.get("kind"));
  if (kind !== "vin" && kind !== "odometer" && kind !== "title" && kind !== "car") return notSaved("unknown photo type.");
  const num = (k: string) => {
    const v = formData.get(k);
    const n = typeof v === "string" && v !== "" ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const capturedRaw = String(formData.get("captured_at") ?? "");
  const captured = capturedRaw && !Number.isNaN(Date.parse(capturedRaw)) ? new Date(capturedRaw).toISOString() : null;
  const result = await recordInspectionPhoto({
    inspectionId: String(formData.get("inspection_id") ?? ""),
    inspectorId: inspector.id,
    userId: ctx.user.id,
    kind,
    storagePath: String(formData.get("storage_path") ?? ""),
    latitude: num("latitude"),
    longitude: num("longitude"),
    accuracyM: num("accuracy_m"),
    capturedAt: captured,
  });
  if (!result.ok) return notSaved(result.message);
  revalidatePath(`/inspector/${String(formData.get("inspection_id"))}`);
  return saved(result.message);
}

export async function submitInspection(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await signedInUser();
  if (!ctx) return notSaved(SESSION_ENDED);
  const inspector = await approvedInspectorFor(ctx.user.id);
  if (!inspector) return notSaved("you're not an approved inspector.");
  const vin = String(formData.get("vin_read") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (vin.length !== 17) return notSaved("enter the 17-character VIN exactly as on the car.");
  const odometer = Number(String(formData.get("odometer") ?? "").replace(/[,\s]/g, ""));
  if (!Number.isInteger(odometer) || odometer < 0 || odometer > 2_000_000) return notSaved("enter the odometer reading in miles.");
  const titleRaw = formData.get("title_matches");
  if (titleRaw !== "yes" && titleRaw !== "no") return notSaved("say whether the title's VIN matches the car.");
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000);

  const inspectionId = String(formData.get("inspection_id") ?? "");
  const result = await submitInspectionReport({
    inspectionId,
    inspectorId: inspector.id,
    vinRead: vin,
    odometer,
    titleMatches: titleRaw === "yes",
    notes,
  });
  if (!result.ok) return notSaved(result.message);
  revalidatePath(`/inspector/${inspectionId}`);
  revalidatePath("/inspector");
  revalidatePath("/admin/reservations");
  return saved(result.message);
}
