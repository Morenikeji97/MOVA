/**
 * MOVA — shipping ESTIMATES for the listing page. Not a quote: the buyer
 * gets a firm price from their chosen shipper after reserving.
 *
 * Published 2026 port-to-port RoRo rates (BR Logistics, WC Shipping, Shipit). Replace with real shipper rates once onboarded.
 *
 * All figures are USD. Duty and port clearing are deliberately not
 * estimated here yet.
 */

export type EstimateCountry = "NG" | "GH" | "TG" | "BJ";

export interface Range {
  min: number;
  max: number;
}

export interface CountryShippingEstimate {
  code: EstimateCountry;
  name: string;
  port: string;
  /** Port-to-port RoRo ocean freight. */
  freight: Range;
  /** A cargo-tracking note the destination requires, if any. */
  trackingNote: { label: "ECTN" | "CTN"; fee: number } | null;
}

export const SHIPPING_ESTIMATES: readonly CountryShippingEstimate[] = [
  { code: "NG", name: "Nigeria", port: "Lagos", freight: { min: 1200, max: 1700 }, trackingNote: null },
  { code: "GH", name: "Ghana", port: "Tema", freight: { min: 1150, max: 1450 }, trackingNote: null },
  {
    code: "TG",
    name: "Togo",
    port: "Lomé",
    freight: { min: 1200, max: 1450 },
    trackingNote: { label: "ECTN", fee: 175 },
  },
  {
    code: "BJ",
    name: "Benin",
    port: "Cotonou",
    freight: { min: 1250, max: 1455 },
    trackingNote: { label: "CTN", fee: 175 },
  },
];

/** Every destination: US pickup to the port (depends on distance). */
export const US_PICKUP_TO_PORT: Range = { min: 300, max: 1500 };

/** Every destination: US export paperwork. */
export const EXPORT_PAPERWORK: Range = { min: 150, max: 600 };

/** The cheapest port-to-port freight across destinations — the "from ~$…" figure. */
export const LOWEST_FREIGHT: number = Math.min(...SHIPPING_ESTIMATES.map((e) => e.freight.min));

export function isEstimateCountry(value: unknown): value is EstimateCountry {
  return SHIPPING_ESTIMATES.some((e) => e.code === value);
}

export function shippingEstimateFor(code: EstimateCountry): CountryShippingEstimate {
  return SHIPPING_ESTIMATES.find((e) => e.code === code)!;
}

/**
 * Which country the picker opens on: a signed-in buyer's profile country
 * first, otherwise the browser's last choice, otherwise none (the buyer
 * picks). Anything that isn't one of the four estimate countries is ignored.
 */
export function initialEstimateCountry(
  profileCountry: string | null | undefined,
  lastChoice: string | null | undefined,
): EstimateCountry | null {
  if (isEstimateCountry(profileCountry)) return profileCountry;
  if (isEstimateCountry(lastChoice)) return lastChoice;
  return null;
}
