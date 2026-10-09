"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ShipmentProofKind, ShipmentShippingStatus } from "@/types/database";
import { SESSION_ENDED, checkWrite, notSaved, saved, type ActionResult } from "@/lib/action-result";
import { notifyDealEvent } from "@/lib/notifications";

const SHIPPING_STATUSES: ShipmentShippingStatus[] = [
  "awaiting_pickup",
  "picked_up",
  "in_transit",
  "delivered",
];

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

function revalidate(shipmentId: string) {
  revalidatePath("/shipper/dashboard");
  revalidatePath(`/shipper/dashboard/${shipmentId}`);
}

/**
 * One-tap shipping-status update. RLS ("shipment requests shipper update
 * shipping status" + the shipment_requests_guard_shipping_status trigger,
 * 0016) is what actually restricts this to the owning shipper and to this
 * one column — this action's own checks are just so a bad value fails
 * loudly instead of silently reverting.
 */
export async function updateShippingStatus(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const shipmentId = str(formData.get("shipmentId"));
  const shippingStatus = str(formData.get("shippingStatus")) as ShipmentShippingStatus;
  if (!shipmentId) return notSaved("the form is missing the shipment. Reload and try again.");
  if (!SHIPPING_STATUSES.includes(shippingStatus)) return notSaved("unknown shipping status.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return notSaved(SESSION_ENDED);

  // The guard trigger (shipment_requests_guard_shipping_status) keeps the
  // old status for a move it doesn't allow, so compare what was saved.
  const { data: before } = await supabase
    .from("shipment_requests")
    .select("shipping_status")
    .eq("id", shipmentId)
    .maybeSingle();
  const res = await supabase
    .from("shipment_requests")
    .update({ shipping_status: shippingStatus })
    .eq("id", shipmentId)
    .select("shipping_status");
  const bad = checkWrite(res, "this shipment isn't yours or wasn't found.");
  if (bad) return bad;
  if (res.data?.[0]?.shipping_status !== shippingStatus) {
    return notSaved("that status change isn't allowed from the current status.");
  }

  if (before?.shipping_status !== shippingStatus && shippingStatus !== "awaiting_pickup") {
    await notifyDealEvent(shippingStatus, { shipmentId });
  }
  revalidate(shipmentId);
  return saved("Status updated — the buyer sees it now (and gets an email).");
}

/** Records an uploaded proof-of-pickup/delivery photo. The file itself is
 * already in the shipment-proof-photos bucket by the time this runs (see
 * ProofPhotoUploader) — this just writes the row that ties it to the
 * shipment. */
export async function addProofPhoto(formData: FormData): Promise<ActionResult> {
  const shipmentId = str(formData.get("shipmentId"));
  const kind = str(formData.get("kind")) as ShipmentProofKind;
  const storagePath = str(formData.get("storagePath"));
  if (!shipmentId || !storagePath || (kind !== "pickup" && kind !== "delivery" && kind !== "bill_of_lading")) {
    return notSaved("the photo upload was incomplete. Try again.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return notSaved(SESSION_ENDED);

  const res = await supabase
    .from("shipment_proof_photos")
    .insert({
      shipment_request_id: shipmentId,
      kind,
      storage_path: storagePath,
      uploaded_by: user.id,
    })
    .select("id");
  const bad = checkWrite(res);
  if (bad) return bad;

  revalidate(shipmentId);
  return saved("Photo added.");
}

export async function addShipmentNote(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const shipmentId = str(formData.get("shipmentId"));
  const note = str(formData.get("note"));
  if (!shipmentId) return notSaved("the form is missing the shipment. Reload and try again.");
  if (!note) return notSaved("write a note first.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return notSaved(SESSION_ENDED);

  const res = await supabase
    .from("shipment_updates")
    .insert({ shipment_request_id: shipmentId, author_id: user.id, note })
    .select("id");
  const bad = checkWrite(res);
  if (bad) return bad;

  revalidate(shipmentId);
  return saved("Note added.");
}
