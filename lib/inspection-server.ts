import { randomInt } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { chooseInspector, inspectorPayUsd, type InspectorCandidate } from "@/lib/inspector-assignment";
import { photoFlags, type PhotoKind } from "@/lib/inspection-checks";
import { ESCROW_STAGES } from "@/lib/escrow";
import type { EscrowStage } from "@/types/database";
import { notifyDealEvent } from "@/lib/notifications";

/**
 * Server-only inspection steps (service role; callers check who's asking).
 * Every write is read back. See lib/inspector-assignment.ts for the rules.
 */

type Admin = ReturnType<typeof createAdminClient>;
export type InspectionResult = { ok: true; message: string; id?: string } | { ok: false; message: string };

const ROTATION_DAYS = 90;

function carPrice(pr: { vehicle_price_usd: number | null; negotiated_price_usd: number | null; negotiated_price_status: string | null }): number {
  return pr.negotiated_price_status === "accepted" && pr.negotiated_price_usd != null
    ? Number(pr.negotiated_price_usd)
    : Number(pr.vehicle_price_usd ?? 0);
}

/** Pick an inspector at random for a reservation and assign them. */
export async function assignInspection(purchaseRequestId: string, adminId: string, admin: Admin = createAdminClient()): Promise<InspectionResult> {
  const { data: pr } = await admin
    .from("purchase_requests")
    .select("id, buyer_id, vehicle_id, status")
    .eq("id", purchaseRequestId)
    .maybeSingle();
  if (!pr) return { ok: false, message: "reservation not found" };
  const { data: open } = await admin
    .from("inspections")
    .select("id, status")
    .eq("purchase_request_id", pr.id)
    .in("status", ["assigned", "submitted", "passed"])
    .maybeSingle();
  if (open) return { ok: false, message: `this deal already has an inspection (${open.status})` };

  const { data: vehicle } = await admin.from("vehicles").select("seller_id, location_state").eq("id", pr.vehicle_id).maybeSingle();
  if (!vehicle) return { ok: false, message: "the car wasn't found" };
  const { data: people } = await admin
    .from("users")
    .select("id, phone, whatsapp_number, signup_ip, signup_device_fingerprint, is_test_account")
    .in("id", [pr.buyer_id, vehicle.seller_id]);
  const seller = people?.find((p) => p.id === vehicle.seller_id);
  const buyer = people?.find((p) => p.id === pr.buyer_id);
  if (!seller || !buyer) return { ok: false, message: "buyer or seller account missing" };

  const { data: inspectors } = await admin
    .from("inspectors")
    .select("id, user_id, status, service_states, is_test, phone")
    .eq("status", "approved");
  if (!inspectors || inspectors.length === 0) return { ok: false, message: "no approved inspectors yet" };
  const userIds = inspectors.map((i) => i.user_id);
  const inspectorIds = inspectors.map((i) => i.id);

  const { data: sellerCars } = await admin.from("vehicles").select("id").eq("seller_id", vehicle.seller_id);
  const sellerCarIds = (sellerCars ?? []).map((c) => c.id);
  const since = new Date(Date.now() - ROTATION_DAYS * 86_400_000).toISOString();
  const [{ data: accounts }, { data: chats }, { data: reservations }, { data: sellerDeals }] = await Promise.all([
    admin.from("users").select("id, phone, whatsapp_number, signup_ip, signup_device_fingerprint").in("id", userIds),
    admin.from("conversations").select("buyer_id").eq("seller_id", vehicle.seller_id).in("buyer_id", userIds),
    sellerCarIds.length
      ? admin.from("purchase_requests").select("buyer_id").in("vehicle_id", sellerCarIds).in("buyer_id", userIds)
      : Promise.resolve({ data: [] as { buyer_id: string }[] }),
    sellerCarIds.length
      ? admin.from("purchase_requests").select("id").in("vehicle_id", sellerCarIds)
      : Promise.resolve({ data: [] as { id: string }[] }),
  ]);
  const sellerDealIds = (sellerDeals ?? []).map((d) => d.id);
  const { data: recent } = sellerDealIds.length
    ? await admin
        .from("inspections")
        .select("inspector_id")
        .in("purchase_request_id", sellerDealIds)
        .in("inspector_id", inspectorIds)
        .gte("created_at", since)
        .neq("status", "cancelled")
    : { data: [] as { inspector_id: string }[] };

  const chatted = new Set((chats ?? []).map((c) => c.buyer_id));
  const reserved = new Set((reservations ?? []).map((r) => r.buyer_id));
  const recentIds = new Set((recent ?? []).map((r) => r.inspector_id));
  const candidates: InspectorCandidate[] = inspectors.map((i) => {
    const a = accounts?.find((x) => x.id === i.user_id);
    return {
      id: i.id,
      userId: i.user_id,
      status: i.status,
      serviceStates: i.service_states,
      isTest: i.is_test,
      phones: [i.phone, a?.phone ?? null, a?.whatsapp_number ?? null],
      signupIp: a?.signup_ip ?? null,
      signupDevice: a?.signup_device_fingerprint ?? null,
      chattedWithSeller: chatted.has(i.user_id),
      reservedSellersCar: reserved.has(i.user_id),
      inspectedSellerRecently: recentIds.has(i.id),
    };
  });

  const choice = chooseInspector(
    candidates,
    {
      sellerId: vehicle.seller_id,
      buyerId: pr.buyer_id,
      vehicleState: vehicle.location_state,
      isTestDeal: Boolean(buyer.is_test_account),
      sellerPhones: [seller.phone, seller.whatsapp_number],
      sellerSignupIp: seller.signup_ip,
      sellerSignupDevice: seller.signup_device_fingerprint,
    },
    (n) => randomInt(n),
  );
  const note = { eligible: choice.eligible, excluded: choice.excluded, ...(choice.ok ? { rotation_relaxed: choice.rotationRelaxed } : {}) };
  if (!choice.ok) return { ok: false, message: `no eligible inspector for ${vehicle.location_state ?? "this state"} — ${JSON.stringify(choice.excluded)}` };

  const res = await admin
    .from("inspections")
    .insert({ purchase_request_id: pr.id, inspector_id: choice.inspectorId, assigned_by: adminId, assignment_note: note })
    .select("id")
    .single();
  if (res.error || !res.data) return { ok: false, message: res.error?.message ?? "the inspection wasn't saved" };
  await notifyDealEvent("inspection_assigned", { inspectionId: res.data.id });
  return {
    ok: true,
    id: res.data.id,
    message: `Inspector assigned at random from ${choice.eligible} eligible${choice.rotationRelaxed ? " (all had inspected this seller recently — flagged)" : ""}.`,
  };
}

/** The signed-in user's inspector row, if approved. */
export async function approvedInspectorFor(userId: string, admin: Admin = createAdminClient()) {
  const { data } = await admin.from("inspectors").select("id, status").eq("user_id", userId).maybeSingle();
  return data?.status === "approved" ? data : null;
}

/** Records one uploaded photo (already in the inspector's own folder). */
export async function recordInspectionPhoto(
  input: {
    inspectionId: string;
    inspectorId: string;
    userId: string;
    kind: PhotoKind;
    storagePath: string;
    latitude: number | null;
    longitude: number | null;
    accuracyM: number | null;
    capturedAt: string | null;
  },
  admin: Admin = createAdminClient(),
): Promise<InspectionResult> {
  if (!input.storagePath.startsWith(`${input.userId}/`)) return { ok: false, message: "the photo isn't in your folder" };
  const { data: x } = await admin.from("inspections").select("id, status").eq("id", input.inspectionId).eq("inspector_id", input.inspectorId).maybeSingle();
  if (!x) return { ok: false, message: "this inspection isn't assigned to you" };
  if (x.status !== "assigned") return { ok: false, message: "this inspection was already sent" };
  const res = await admin
    .from("inspection_photos")
    .insert({
      inspection_id: x.id,
      kind: input.kind,
      storage_path: input.storagePath,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy_m: input.accuracyM,
      captured_at: input.capturedAt,
    })
    .select("id")
    .single();
  if (res.error || !res.data) return { ok: false, message: res.error?.message ?? "the photo wasn't recorded" };
  return { ok: true, message: "Photo added." };
}

/** The inspector sends their report; photo checks are recorded with it. */
export async function submitInspectionReport(
  input: { inspectionId: string; inspectorId: string; vinRead: string; odometer: number; titleMatches: boolean; notes: string },
  admin: Admin = createAdminClient(),
): Promise<InspectionResult> {
  const { data: x } = await admin
    .from("inspections")
    .select("id, status, assigned_at")
    .eq("id", input.inspectionId)
    .eq("inspector_id", input.inspectorId)
    .maybeSingle();
  if (!x) return { ok: false, message: "this inspection isn't assigned to you" };
  if (x.status !== "assigned") return { ok: false, message: "this inspection was already sent" };
  const { data: photos } = await admin
    .from("inspection_photos")
    .select("kind, latitude, longitude, accuracy_m, captured_at")
    .eq("inspection_id", x.id);
  const flags = photoFlags(
    (photos ?? []).map((p) => ({ kind: p.kind, latitude: p.latitude, longitude: p.longitude, accuracyM: p.accuracy_m, capturedAt: p.captured_at })),
    x.assigned_at,
  );
  const missing = flags.filter((f) => f.startsWith("missing_"));
  if (missing.length) return { ok: false, message: "add the VIN plate, odometer and title photos first." };
  const res = await admin
    .from("inspections")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      vin_read: input.vinRead,
      odometer_reading: input.odometer,
      title_matches: input.titleMatches,
      condition_notes: input.notes || null,
      photo_check_flags: flags,
    })
    .eq("id", x.id)
    .eq("status", "assigned")
    .select("status");
  if (res.error || res.data?.[0]?.status !== "submitted") return { ok: false, message: res.error?.message ?? "the report wasn't saved" };
  return { ok: true, message: "Report sent to ShipMova." };
}

function laterStage(current: EscrowStage | null, candidate: EscrowStage): EscrowStage {
  const order = ESCROW_STAGES.map((s) => s.stage);
  return current && order.indexOf(current) >= order.indexOf(candidate) ? current : candidate;
}

/** Admin passes or fails a submitted inspection; records the inspector's 2% pay. */
export async function decideInspection(
  input: { inspectionId: string; pass: boolean; note: string; adminId: string },
  admin: Admin = createAdminClient(),
): Promise<InspectionResult & { payUsd?: number }> {
  const { data: x } = await admin
    .from("inspections")
    .select("id, status, pay_pct, purchase_request_id")
    .eq("id", input.inspectionId)
    .maybeSingle();
  if (!x) return { ok: false, message: "inspection not found" };
  if (x.status !== "submitted") return { ok: false, message: `this inspection is ${x.status}, not waiting for a decision` };
  const { data: pr } = await admin
    .from("purchase_requests")
    .select("id, vehicle_price_usd, negotiated_price_usd, negotiated_price_status, escrow_stage")
    .eq("id", x.purchase_request_id)
    .maybeSingle();
  if (!pr) return { ok: false, message: "the deal wasn't found" };
  const payUsd = inspectorPayUsd(carPrice(pr), Number(x.pay_pct));

  const res = await admin
    .from("inspections")
    .update({
      status: input.pass ? "passed" : "failed",
      decided_at: new Date().toISOString(),
      decided_by: input.adminId,
      decision_note: input.note || null,
      pay_usd: payUsd,
      pay_status: "owed",
    })
    .eq("id", x.id)
    .eq("status", "submitted")
    .select("status, pay_usd");
  if (res.error || res.data?.[0]?.status !== (input.pass ? "passed" : "failed")) {
    return { ok: false, message: res.error?.message ?? "the decision wasn't saved" };
  }
  await notifyDealEvent(input.pass ? "inspection_passed" : "inspection_failed", { inspectionId: x.id });
  if (input.pass) {
    const stage = laterStage(pr.escrow_stage, "inspection_passed");
    if (stage !== pr.escrow_stage) {
      const st = await admin.from("purchase_requests").update({ escrow_stage: stage }).eq("id", pr.id).select("escrow_stage");
      if (st.error || st.data?.[0]?.escrow_stage !== stage) {
        return { ok: true, payUsd, message: `Passed — but the deal's stage didn't update (${st.error?.message ?? "no row"}). Set "Inspection passed" by hand.` };
      }
    }
  }
  return { ok: true, payUsd, message: `${input.pass ? "Passed" : "Failed"} — inspector pay of $${payUsd.toFixed(2)} recorded as owed.` };
}
