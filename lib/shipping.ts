import { round2 } from "./fees.ts";
import type { ShipperPaymentStatus, ShippingMethod, VehicleSizeType } from "@/types/database";

/**
 * MOVA's commission on a completed shipment, as a whole-number percent. Stored
 * per-row on shipment_requests.commission_pct at selection time so historical
 * rows keep the rate they were created under, but new rows use this value.
 */
export const SHIPPER_COMMISSION_PCT = 8;

/**
 * How many *unpaid* (charge failed) commissions a shipper may accumulate before
 * they are auto-suspended. "More than" this number — i.e. the 3rd failure
 * flips payment_status to 'suspended'. Failures dated before a shipper's
 * `reinstated_at` don't count.
 */
export const SHIPPER_SUSPEND_AFTER_UNPAID = 2;

/** Countries MOVA ships to. ISO-3166 alpha-2 codes stored in the DB. */
export const SERVICE_COUNTRIES = [
  { code: "NG", name: "Nigeria" },
  { code: "GH", name: "Ghana" },
  { code: "TG", name: "Togo" },
  { code: "BJ", name: "Benin" },
] as const;

export type ServiceCountryCode = (typeof SERVICE_COUNTRIES)[number]["code"];

const COUNTRY_NAME: Record<string, string> = Object.fromEntries(
  SERVICE_COUNTRIES.map((c) => [c.code, c.name]),
);

/** "NG" -> "Nigeria"; unknown codes pass through unchanged. */
export function countryName(code: string | null | undefined): string {
  if (!code) return "—";
  return COUNTRY_NAME[code] ?? code;
}

export function isServiceCountry(code: string): code is ServiceCountryCode {
  return SERVICE_COUNTRIES.some((c) => c.code === code);
}

/** The two size classes a shipper prices against — matches vehicles.vehicle_size_type. */
export const VEHICLE_SIZE_TYPES: { value: VehicleSizeType; label: string }[] = [
  { value: "sedan", label: "Sedan" },
  { value: "suv_truck", label: "SUV / Truck" },
];

export function isVehicleSizeType(v: string): v is VehicleSizeType {
  return VEHICLE_SIZE_TYPES.some((t) => t.value === v);
}

export const SHIPPING_METHODS: { value: ShippingMethod; label: string }[] = [
  { value: "roro", label: "RoRo" },
  { value: "container", label: "Container" },
];

export function isShippingMethod(v: string): v is ShippingMethod {
  return SHIPPING_METHODS.some((m) => m.value === v);
}

const VEHICLE_SIZE_LABEL: Record<VehicleSizeType, string> = {
  sedan: "Sedan",
  suv_truck: "SUV / Truck",
};

const SHIPPING_METHOD_LABEL: Record<ShippingMethod, string> = {
  roro: "RoRo",
  container: "Container",
};

export function vehicleSizeLabel(v: VehicleSizeType): string {
  return VEHICLE_SIZE_LABEL[v];
}

export function shippingMethodLabel(m: ShippingMethod): string {
  return SHIPPING_METHOD_LABEL[m];
}

/** MOVA's commission owed on an agreed shipping rate. */
export function commissionOwed(
  agreedRate: number,
  pct: number = SHIPPER_COMMISSION_PCT,
): number {
  return round2((round2(agreedRate) * pct) / 100);
}

/**
 * True if a shipper's declared pickup service_areas (US state codes) covers
 * the vehicle's own location_state — same granularity, see lib/us-states.ts.
 * Ranking/surfacing only: a Buyer can still see and pick a shipper this
 * returns false for (see compareRatesForBuyer below and the "Local pickup"
 * badge in app/browse/[id]/shipping-rates.tsx) — nothing filters them out.
 */
export function isLocalPickup(
  serviceAreas: string[] | null | undefined,
  vehicleState: string | null | undefined,
): boolean {
  return !!vehicleState && !!serviceAreas?.includes(vehicleState);
}

/**
 * Buyer-facing rate ordering: shippers whose service_areas cover the
 * vehicle's pickup state first, then shippers in good standing, then
 * cheapest price. `past_due` shippers stay visible but sink within their
 * local/non-local group; `suspended` shippers are filtered out upstream
 * (shipper_rates_public / RLS) and never reach here. `vehicleState` is
 * optional so existing callers (and rates with no location context) keep
 * their prior ordering unchanged.
 */
export function compareRatesForBuyer(
  a: {
    payment_status: ShipperPaymentStatus | null;
    price: number | null;
    service_areas?: string[] | null;
  },
  b: {
    payment_status: ShipperPaymentStatus | null;
    price: number | null;
    service_areas?: string[] | null;
  },
  vehicleState?: string | null,
): number {
  const localRank = (r: { service_areas?: string[] | null }) =>
    isLocalPickup(r.service_areas, vehicleState) ? 0 : 1;
  const standingRank = (s: ShipperPaymentStatus | null) =>
    s === "good_standing" ? 0 : 1;
  return (
    localRank(a) - localRank(b) ||
    standingRank(a.payment_status) - standingRank(b.payment_status) ||
    (a.price ?? Infinity) - (b.price ?? Infinity)
  );
}
