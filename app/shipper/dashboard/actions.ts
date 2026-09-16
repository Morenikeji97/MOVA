"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ShipmentProofKind, ShipmentShippingStatus } from "@/types/database";

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
export async function updateShippingStatus(formData: FormData): Promise<void> {
  const shipmentId = str(formData.get("shipmentId"));
  const shippingStatus = str(formData.get("shippingStatus")) as ShipmentShippingStatus;
  if (!shipmentId || !SHIPPING_STATUSES.includes(shippingStatus)) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("shipment_requests")
    .update({ shipping_status: shippingStatus })
    .eq("id", shipmentId);

  revalidate(shipmentId);
}

/** Records an uploaded proof-of-pickup/delivery photo. The file itself is
 * already in the shipment-proof-photos bucket by the time this runs (see
 * ProofPhotoUploader) — this just writes the row that ties it to the
 * shipment. */
export async function addProofPhoto(formData: FormData): Promise<void> {
  const shipmentId = str(formData.get("shipmentId"));
  const kind = str(formData.get("kind")) as ShipmentProofKind;
  const storagePath = str(formData.get("storagePath"));
  if (!shipmentId || !storagePath || (kind !== "pickup" && kind !== "delivery")) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("shipment_proof_photos").insert({
    shipment_request_id: shipmentId,
    kind,
    storage_path: storagePath,
    uploaded_by: user.id,
  });

  revalidate(shipmentId);
}

export async function addShipmentNote(formData: FormData): Promise<void> {
  const shipmentId = str(formData.get("shipmentId"));
  const note = str(formData.get("note"));
  if (!shipmentId || !note) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("shipment_updates").insert({
    shipment_request_id: shipmentId,
    author_id: user.id,
    note,
  });

  revalidate(shipmentId);
}
