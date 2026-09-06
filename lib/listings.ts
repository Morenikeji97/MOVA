import type { createClient } from "@/lib/supabase/server";
import type { VehicleCardData } from "@/components/ui/vehicle-card";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Columns a vehicle card needs. Shared so /browse and the homepage grid select
 * exactly the same shape and stay aligned with <VehicleCard>.
 */
export const LISTING_CARD_COLUMNS =
  "id, year, make, model, trim, price_usd, fee_responsibility, mileage, location_city, location_state" as const;

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
