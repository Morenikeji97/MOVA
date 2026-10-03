/**
 * ShipMova — ESTIMATED Nigerian import charges and landed cost for the
 * listing page. Not a quote, and ShipMova does not handle customs: the
 * buyer's clearing agent pays the real figures, which Nigeria Customs works
 * out from its own valuation of the car (not the price paid).
 *
 * The live rates are in the import_rates table (migration 0051), edited by
 * staff at /admin/import-rates. DEFAULT_NG_RATES below is the fallback when
 * the table can't be read, and the values it was seeded with: published 2026
 * rates (Precebol Logistics; legit.ng, 27 Aug 2026), after the 1 July 2026
 * change that cut the NAC levy on used cars from 15% to 5% and added an
 * engine-size green tax.
 *
 *   Import duty        of CIF
 *   NAC levy           of CIF
 *   Green tax          of CIF, by engine size
 *   Surcharge          of the import duty
 *   ETLS levy          of CIF
 *   Customs FOB charge of FOB  (Customs has applied 1% CISS or 4% FOB
 *                               inconsistently since Aug 2025; the default
 *                               is the higher figure so the estimate
 *                               doesn't come in low)
 *   VAT                of CIF + every charge above
 *
 * All money is USD; rates are fractions (0.2 = 20%).
 */

import type { Range } from "./shipping-estimates.ts";

export interface NigeriaRates {
  importDuty: number;
  nacLevy: number;
  greenTax: Record<EngineSize, number>;
  surchargeOfDuty: number;
  etls: number;
  fobCharge: number;
  vat: number;
  /** Marine insurance, as a share of the car price, for the CIF value. */
  insurance: number;
  /** Port, terminal, shipping-line and clearing-agent charges at Lagos — not duty. */
  portAndClearing: Range;
}

export type EngineSize = "under_2l" | "2_to_4l" | "4l_plus";

export const ENGINE_SIZES: readonly { value: EngineSize; label: string }[] = [
  { value: "under_2l", label: "Under 2.0L" },
  { value: "2_to_4l", label: "2.0L – 3.9L" },
  { value: "4l_plus", label: "4.0L or more" },
];

/** Used when the buyer hasn't said — the middle band, so we don't guess low. */
export const DEFAULT_ENGINE_SIZE: EngineSize = "2_to_4l";

export const DEFAULT_NG_RATES: NigeriaRates = {
  importDuty: 0.2,
  nacLevy: 0.05,
  greenTax: { under_2l: 0, "2_to_4l": 0.02, "4l_plus": 0.04 },
  surchargeOfDuty: 0.07,
  etls: 0.005,
  fobCharge: 0.04,
  vat: 0.075,
  insurance: 0.015,
  portAndClearing: { min: 500, max: 1000 },
};

function round0(n: number): number {
  return Math.round(n);
}

export interface NigeriaCharges {
  cif: number;
  importDuty: number;
  nacLevy: number;
  greenTax: number;
  surcharge: number;
  etls: number;
  fobCharge: number;
  vat: number;
  /** Everything paid to Nigerian Customs. */
  total: number;
}

/**
 * Customs charges for one car price and one freight figure. FOB is the car
 * price; CIF adds insurance and ocean freight.
 */
export function nigeriaCustomsCharges(
  vehiclePrice: number,
  freight: number,
  engine: EngineSize = DEFAULT_ENGINE_SIZE,
  rates: NigeriaRates = DEFAULT_NG_RATES,
): NigeriaCharges {
  const fob = vehiclePrice;
  const cif = fob + fob * rates.insurance + freight;
  const importDuty = cif * rates.importDuty;
  const nacLevy = cif * rates.nacLevy;
  const greenTax = cif * rates.greenTax[engine];
  const surcharge = importDuty * rates.surchargeOfDuty;
  const etls = cif * rates.etls;
  const fobCharge = fob * rates.fobCharge;
  const beforeVat = importDuty + nacLevy + greenTax + surcharge + etls + fobCharge;
  const vat = (cif + beforeVat) * rates.vat;
  return {
    cif: round0(cif),
    importDuty: round0(importDuty),
    nacLevy: round0(nacLevy),
    greenTax: round0(greenTax),
    surcharge: round0(surcharge),
    etls: round0(etls),
    fobCharge: round0(fobCharge),
    vat: round0(vat),
    total: round0(beforeVat + vat),
  };
}

export interface NigeriaLandedEstimate {
  /** Customs charges at the low and high freight. */
  low: NigeriaCharges;
  high: NigeriaCharges;
  /** Shipping-side costs, summed: freight + US pickup + export paperwork. */
  shipping: Range;
  portAndClearing: Range;
  /** Everything from the buyer's pocket to the car at Lagos, out of port. */
  landed: Range;
}

/**
 * The full estimated landed cost in Lagos: what the buyer pays on ShipMova
 * before shipping (car + fee + escrow), plus shipping, Customs charges, and
 * port/clearing.
 */
export function nigeriaLandedEstimate(input: {
  vehiclePrice: number;
  totalBeforeShipping: number;
  freight: Range;
  usPickup: Range;
  exportPaperwork: Range;
  engine?: EngineSize;
  rates?: NigeriaRates;
}): NigeriaLandedEstimate {
  const engine = input.engine ?? DEFAULT_ENGINE_SIZE;
  const rates = input.rates ?? DEFAULT_NG_RATES;
  const low = nigeriaCustomsCharges(input.vehiclePrice, input.freight.min, engine, rates);
  const high = nigeriaCustomsCharges(input.vehiclePrice, input.freight.max, engine, rates);
  const shipping: Range = {
    min: input.freight.min + input.usPickup.min + input.exportPaperwork.min,
    max: input.freight.max + input.usPickup.max + input.exportPaperwork.max,
  };
  const pc = rates.portAndClearing;
  const landed: Range = {
    min: round0(input.totalBeforeShipping + shipping.min + low.total + pc.min),
    max: round0(input.totalBeforeShipping + shipping.max + high.total + pc.max),
  };
  return { low, high, shipping, portAndClearing: pc, landed };
}

// ---------------------------------------------------------------------------
// The import_rates row <-> NigeriaRates, and the admin form
// ---------------------------------------------------------------------------

/** A public.import_rates row as Supabase returns it (numerics may be strings). */
export interface ImportRatesRow {
  import_duty_rate: number | string;
  nac_levy_rate: number | string;
  green_tax_under_2l_rate: number | string;
  green_tax_2_to_4l_rate: number | string;
  green_tax_4l_plus_rate: number | string;
  surcharge_rate_of_duty: number | string;
  etls_rate: number | string;
  fob_charge_rate: number | string;
  vat_rate: number | string;
  insurance_rate: number | string;
  port_clearing_min_usd: number | string;
  port_clearing_max_usd: number | string;
}

export function ratesFromRow(row: ImportRatesRow): NigeriaRates {
  const n = Number;
  return {
    importDuty: n(row.import_duty_rate),
    nacLevy: n(row.nac_levy_rate),
    greenTax: {
      under_2l: n(row.green_tax_under_2l_rate),
      "2_to_4l": n(row.green_tax_2_to_4l_rate),
      "4l_plus": n(row.green_tax_4l_plus_rate),
    },
    surchargeOfDuty: n(row.surcharge_rate_of_duty),
    etls: n(row.etls_rate),
    fobCharge: n(row.fob_charge_rate),
    vat: n(row.vat_rate),
    insurance: n(row.insurance_rate),
    portAndClearing: { min: n(row.port_clearing_min_usd), max: n(row.port_clearing_max_usd) },
  };
}

/**
 * The admin form's fields. Rates are typed as percents ("20" = 20%), the
 * port/clearing range in whole US dollars.
 */
export const RATE_FIELDS: readonly {
  name: keyof ImportRatesRow;
  label: string;
  kind: "percent" | "usd";
}[] = [
  { name: "import_duty_rate", label: "Import duty (% of CIF)", kind: "percent" },
  { name: "nac_levy_rate", label: "NAC levy, used cars (% of CIF)", kind: "percent" },
  { name: "green_tax_under_2l_rate", label: "Green tax, under 2.0L (% of CIF)", kind: "percent" },
  { name: "green_tax_2_to_4l_rate", label: "Green tax, 2.0–3.9L (% of CIF)", kind: "percent" },
  { name: "green_tax_4l_plus_rate", label: "Green tax, 4.0L+ (% of CIF)", kind: "percent" },
  { name: "surcharge_rate_of_duty", label: "Surcharge (% of import duty)", kind: "percent" },
  { name: "etls_rate", label: "ETLS levy (% of CIF)", kind: "percent" },
  { name: "fob_charge_rate", label: "Customs FOB charge (% of FOB)", kind: "percent" },
  { name: "vat_rate", label: "VAT (% of CIF + charges)", kind: "percent" },
  { name: "insurance_rate", label: "Insurance for CIF (% of car price)", kind: "percent" },
  { name: "port_clearing_min_usd", label: "Port & clearing, low (USD)", kind: "usd" },
  { name: "port_clearing_max_usd", label: "Port & clearing, high (USD)", kind: "usd" },
];

/** Percent shown in the form for a stored fraction: 0.075 -> "7.5". */
export function fractionToPercentText(f: number | string): string {
  return String(Math.round(Number(f) * 100 * 1000) / 1000);
}

export type ParsedRates =
  | { ok: true; row: Record<keyof ImportRatesRow, number> }
  | { ok: false; error: string };

/**
 * Validates the admin form. Percents must be 0–100 (stored as fractions,
 * 4 decimal places like the column); dollar amounts 0–100,000 with
 * low <= high.
 */
export function parseRatesForm(get: (name: string) => unknown): ParsedRates {
  const row = {} as Record<keyof ImportRatesRow, number>;
  for (const f of RATE_FIELDS) {
    const raw = get(f.name);
    const text = typeof raw === "string" ? raw.trim().replace(/[%$,\s]/g, "") : "";
    if (text === "" || !/^\d+(\.\d+)?$/.test(text)) {
      return { ok: false, error: `${f.label}: enter a number.` };
    }
    const value = Number(text);
    if (f.kind === "percent") {
      if (value > 100) return { ok: false, error: `${f.label}: must be 0–100.` };
      row[f.name] = Math.round((value / 100) * 10_000) / 10_000;
    } else {
      if (value > 100_000) return { ok: false, error: `${f.label}: too large.` };
      row[f.name] = Math.round(value * 100) / 100;
    }
  }
  if (row.port_clearing_max_usd < row.port_clearing_min_usd) {
    return { ok: false, error: "Port & clearing: the high figure must be at least the low one." };
  }
  return { ok: true, row };
}

/** "import_duty_rate 0.2 -> 0.25; vat_rate …" — for the audit log. */
export function describeRateChanges(
  before: Partial<Record<keyof ImportRatesRow, number | string>>,
  after: Record<keyof ImportRatesRow, number>,
): string {
  const changes = RATE_FIELDS.filter((f) => Number(before[f.name]) !== after[f.name]).map(
    (f) => `${f.name} ${Number(before[f.name])} -> ${after[f.name]}`,
  );
  return changes.length > 0 ? changes.join("; ") : "no rate changes; marked as checked";
}
