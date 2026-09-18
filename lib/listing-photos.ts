import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const MAX_LISTING_PHOTOS = 20;

export type PhotoInput = {
  path: string;
  url: string;
  isPrimary: boolean;
};

export type ReconcilePhotosResult = { ok: true } | { ok: false; error: string };

/**
 * Reconciles a vehicle's photo gallery against the submitted final list —
 * shared by the seller "edit photos" server action and (indirectly, via the
 * same shape) verifiable independently of any request/session context,
 * since it only needs a Supabase client, not cookies.
 *
 * SEQUENCING MATTERS: insert-then-update-then-delete, never delete-first.
 * vehicle_photos_prevent_empty (migration 0026) rejects any statement that
 * would leave a vehicle with zero photo rows — deleting the old set before
 * inserting the new one would transiently hit zero and get rejected even
 * for a completely legitimate "swap every photo" edit. Inserting the newly
 * added photos (and updating kept ones) first means the removed rows are
 * always deleted from a pool that already includes their replacements, so
 * the count never drops below the final, validated (>= 1) total.
 *
 * Caller is responsible for auth/ownership checks and the basic shape
 * validation (non-empty, under the max, exactly one primary) — this
 * function assumes `photos` has already passed those.
 */
export async function reconcileListingPhotos(
  supabase: SupabaseClient<Database>,
  vehicleId: string,
  photos: PhotoInput[],
): Promise<ReconcilePhotosResult> {
  const { data: existing, error: fetchError } = await supabase
    .from("vehicle_photos")
    .select("id, url")
    .eq("vehicle_id", vehicleId);
  if (fetchError) {
    console.error("reconcileListingPhotos: fetch existing failed", fetchError);
    return { ok: false, error: "Couldn't load the current photos. Please try again." };
  }

  const existingByUrl = new Map((existing ?? []).map((row) => [row.url, row.id]));
  const newUrls = new Set(photos.map((p) => p.url));
  const toInsert = photos.filter((p) => !existingByUrl.has(p.url));
  const toDeleteIds = (existing ?? [])
    .filter((row) => !newUrls.has(row.url))
    .map((row) => row.id);

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from("vehicle_photos").insert(
      toInsert.map((photo) => ({
        vehicle_id: vehicleId,
        url: photo.url,
        sort_order: photos.indexOf(photo),
        // Primary flag is finalized below, after every row (kept + new)
        // has been cleared to false — avoids a transient unique-index
        // conflict (vehicle_photos_one_primary_per_vehicle) with whichever
        // existing row currently holds is_primary = true.
        is_primary: false,
      })),
    );
    if (insertError) {
      console.error("reconcileListingPhotos: insert failed", insertError);
      return { ok: false, error: "Couldn't save the new photos. Please try again." };
    }
  }

  // Update sort_order for every kept row; clear is_primary everywhere first.
  for (const [index, photo] of photos.entries()) {
    const existingId = existingByUrl.get(photo.url);
    if (existingId) {
      const { error: updateError } = await supabase
        .from("vehicle_photos")
        .update({ sort_order: index, is_primary: false })
        .eq("id", existingId);
      if (updateError) {
        console.error("reconcileListingPhotos: reorder update failed", updateError);
        return { ok: false, error: "Couldn't save the photo order. Please try again." };
      }
    }
  }

  if (toDeleteIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("vehicle_photos")
      .delete()
      .in("id", toDeleteIds);
    if (deleteError) {
      console.error("reconcileListingPhotos: delete failed", deleteError);
      return { ok: false, error: "Couldn't remove the deleted photos. Please try again." };
    }
  }

  const primaryPhoto = photos.find((p) => p.isPrimary)!;
  const { error: primaryError } = await supabase
    .from("vehicle_photos")
    .update({ is_primary: true })
    .eq("vehicle_id", vehicleId)
    .eq("url", primaryPhoto.url);
  if (primaryError) {
    console.error("reconcileListingPhotos: set primary failed", primaryError);
    return { ok: false, error: "Couldn't set the cover photo. Please try again." };
  }

  return { ok: true };
}
