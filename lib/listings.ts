import type { createClient } from "@/lib/supabase/server";
import type { VehicleCardData } from "@/components/ui/vehicle-card";
import { LISTING_BADGE_COLUMNS } from "@/lib/listing-badges";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Columns a vehicle card needs. Shared so /browse and the homepage grid select
 * exactly the same shape and stay aligned with <VehicleCard>. Selects
 * `vin_masked` (a generated column, migration 0036) — the raw `vin` column
 * isn't readable with the anon key (0037). A card never shows the full VIN.
 *
 * Also pulls in LISTING_BADGE_COLUMNS (lib/listing-badges.ts) so a card can
 * evaluate the real "Title reviewed"/"Verified Listing" rules instead of
 * trusting title_identity_match_confirmed on its own — see migration 0032.
 */
export const LISTING_CARD_COLUMNS =
  `id, year, make, model, trim, price_usd, fee_responsibility, mileage, location_city, location_state, vin_masked, vin_model_year_code, ${LISTING_BADGE_COLUMNS}` as const;

/**
 * Full vehicle detail, for surfaces that render (almost) every column:
 * /browse/[id], the seller's own listings, and the admin review queues.
 *
 * Leaves out `vin`, `title_photo_path` and `authorization_document_path`,
 * which aren't readable with the anon key (0037). Use `vin_masked` plus
 * loadFullVins() for the VIN, and the `has_*_document` flags for "is there
 * a document"; only the admin review page needs the actual paths, and it
 * reads them with the secret-key client.
 *
 * The badge-relevant columns come from LISTING_BADGE_COLUMNS
 * (lib/listing-badges.ts), shared with LISTING_CARD_COLUMNS so the detail
 * page and the cards can't evaluate the badge rules against different data.
 */
export const VEHICLE_DETAIL_COLUMNS =
  `id, seller_id, vin_decode_status, vin_masked, vin_model_year_code, vehicle_size_type, year, make, model, trim, mileage, exterior_color, interior_color, transmission, fuel_type, condition, accident_history, title_status, title_history_check_status, title_identity_match_confirmed_by, location_city, location_state, price_usd, fee_responsibility, description, status, verification_status, rejection_reason, created_at, updated_at, ${LISTING_BADGE_COLUMNS}` as const;

/**
 * Full VINs the current user is entitled to, keyed by vehicle id. Calls the
 * `vehicle_vin` RPC (migration 0036), which does the permission check itself
 * — admin, the listing's own seller, or a buyer past the fee-paid reveal —
 * and returns NULL otherwise, so ids the caller isn't entitled to are simply
 * absent from the map. Signed-out callers get an empty map without a round
 * trip (anon can't execute the function).
 */
export async function loadFullVins(
  supabase: ServerSupabase,
  vehicleIds: string[],
): Promise<Map<string, string>> {
  const vins = new Map<string, string>();
  if (vehicleIds.length === 0) return vins;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return vins;

  const results = await Promise.all(
    vehicleIds.map(async (id) => {
      const { data } = await supabase.rpc("vehicle_vin", { p_vehicle_id: id });
      return [id, data] as const;
    }),
  );
  for (const [id, vin] of results) {
    if (vin) vins.set(id, vin);
  }
  return vins;
}

/**
 * Primary photo per vehicle: the first by sort_order, unless one is explicitly
 * flagged is_primary. Returns an empty map for an empty id list.
 */
export async function loadListingThumbnails(
  supabase: ServerSupabase,
  vehicleIds: string[],
): Promise<Map<string, string>> {
  const thumbByVehicle = new Map<string, string>();
  if (vehicleIds.length === 0) return thumbByVehicle;

  const { data: photos } = await supabase
    .from("vehicle_photos")
    .select("vehicle_id, url, is_primary, sort_order")
    .in("vehicle_id", vehicleIds)
    .order("sort_order", { ascending: true });

  for (const p of photos ?? []) {
    if (!thumbByVehicle.has(p.vehicle_id) || p.is_primary) {
      thumbByVehicle.set(p.vehicle_id, p.url);
    }
  }
  return thumbByVehicle;
}

/**
 * The most recent publicly-visible listings, newest first — the same base query
 * /browse runs (status = 'approved', ordered by created_at desc), without its
 * make/price filters. Backs the homepage's live listings grid.
 */
export async function loadRecentApprovedListings(
  supabase: ServerSupabase,
  limit: number,
): Promise<{ rows: VehicleCardData[]; thumbByVehicle: Map<string, string> }> {
  const { data, error } = await supabase
    .from("vehicles")
    .select(LISTING_CARD_COLUMNS)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);

  // Surface a failed fetch instead of letting `data ?? []` mask it as "zero
  // approved listings" and silently fall back to the homepage sample card.
  if (error) {
    console.error("loadRecentApprovedListings: vehicles query failed", error);
  }

  const rows = (data ?? []) as VehicleCardData[];
  const thumbByVehicle = await loadListingThumbnails(
    supabase,
    rows.map((r) => r.id),
  );
  return { rows, thumbByVehicle };
}
