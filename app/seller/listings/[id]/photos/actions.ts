"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  reconcileListingPhotos,
  MAX_LISTING_PHOTOS,
  type PhotoInput,
} from "@/lib/listing-photos";

export type { PhotoInput };
export type UpdateListingPhotosResult = { ok: true } | { ok: false; error: string };

/**
 * Seller-facing entry point: validates shape, checks ownership, then hands
 * off to reconcileListingPhotos (lib/listing-photos.ts) for the actual
 * insert/update/delete sequencing. RLS ("vehicle photos write by owner")
 * already restricts writes to the owning seller (or admin); the ownership
 * check here is a fast, friendly error path, not the security boundary.
 */
export async function updateListingPhotos(
  vehicleId: string,
  photos: PhotoInput[],
): Promise<UpdateListingPhotosResult> {
  if (typeof vehicleId !== "string" || vehicleId.length === 0) {
    return { ok: false, error: "Something went wrong. Please reload and try again." };
  }
  if (photos.length === 0) {
    return { ok: false, error: "A listing needs at least one photo." };
  }
  if (photos.length > MAX_LISTING_PHOTOS) {
    return { ok: false, error: `You can add up to ${MAX_LISTING_PHOTOS} photos.` };
  }
  const primaryCount = photos.filter((p) => p.isPrimary).length;
  if (primaryCount !== 1) {
    return { ok: false, error: "Choose exactly one cover photo." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in and try again." };

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, seller_id")
    .eq("id", vehicleId)
    .maybeSingle();
  if (!vehicle || vehicle.seller_id !== user.id) {
    return { ok: false, error: "This listing isn't available." };
  }

  const result = await reconcileListingPhotos(supabase, vehicleId, photos);
  if (!result.ok) return result;

  revalidatePath("/seller/listings");
  revalidatePath(`/seller/listings/${vehicleId}/photos`);
  revalidatePath(`/browse/${vehicleId}`);
  revalidatePath("/browse");
  revalidatePath("/");

  return { ok: true };
}
