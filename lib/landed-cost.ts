/**
 * ShipMova — ESTIMATED delivered ("landed") cost at the buyer's port: what
 * they pay on ShipMova before shipping, plus shipping to the port, plus
 * import duties and taxes, fixed customs fees, and port & clearing.
 *
 * Not a quote. ShipMova doesn't clear customs: the buyer's clearing agent
 * pays the real figures, which customs work out from their own reference
 * value for the car (not the price paid). So duties are a low–high PERCENT
 * OF CIF per country, with the source and the date it was last checked,
 * and every figure says "confirm with your clearing agent".
 *
 * Live rates: public.landed_cost_rates (0068), edited by staff at
 * /admin/landed-cost. DEFAULT_LANDED_COST_RATES is the same seed data, used
 * when the table can't be read. All money USD. No imports beyond a type,
 * so node tests can use it.
 */

import type { Range } from "./shipping-estimates.ts";

export type LandedCountry = "NG" | "GH" | "TG" | "BJ";

export type LandedCostRates = {
  /** Duties and taxes, low and high, as a percent of CIF (40 = 40%). */
  dutiesPct: Range;
  /** Marine insurance as a percent of the car price, for the CIF value. */
  insurancePct: number;
  /** Fixed customs fees per declaration, USD. */
  fixedFeesUsd: number;
  /** Port, terminal and clearing-agent charges, USD; null = no source, not included. */
  portClearing: Range | null;
  sourceNote: string;
  sourceUrl: string | null;
  /** YYYY-MM-DD. */
  lastCheckedOn: string;
};

export const DEFAULT_LANDED_COST_RATES: Record<LandedCountry, LandedCostRates> = {
  NG: {
    dutiesPct: { min: 40, max: 45 },
    insurancePct: 1.5,
    fixedFeesUsd: 0,
    portClearing: { min: 500, max: 1000 },
    sourceNote:
      "Computed from published 2026 rates (Precebol Logistics; legit.ng, 27 Aug 2026): about 40% (under 2.0L) to 45% (4.0L+) of CIF.",
    sourceUrl:
      "https://www.legit.ng/business-economy/industry/1725778-nigeria-car-import-rules-2026-cars-import-age-limit-lhd-rule-levies/",
    lastCheckedOn: "2026-10-09",
  },
  GH: {
    dutiesPct: { min: 31, max: 49 },
    insurancePct: 1.5,
    fixedFeesUsd: 0,
    portClearing: null,
    sourceNote:
      "Computed from published 2026 components (duty 5–20% by engine size, levies, VAT/NHIL/GETFund): about 31% to 49% of CIF. Over-age penalty extra above 10 years.",
    sourceUrl: "https://kitannex.com/knowledge-base/customs",
    lastCheckedOn: "2026-10-09",
  },
  TG: {
    dutiesPct: { min: 44, max: 53 },
    insurancePct: 1.5,
    fixedFeesUsd: 0,
    portClearing: { min: 450, max: 1050 },
    sourceNote: "Published estimate (actulome.com, 19 Jun 2026): duties + VAT about 44–53% of CIF at Lomé.",
    sourceUrl: "https://actulome.com/importer-voiture-etranger-togo-taxes-couts/",
    lastCheckedOn: "2026-10-09",
  },
  BJ: {
    dutiesPct: { min: 32, max: 40 },
    insurancePct: 1.5,
    fixedFeesUsd: 175,
    portClearing: { min: 975, max: 975 },
    sourceNote:
      "Published estimate (adtranslogistics.com, 2026): about 32–40% of CIF at Cotonou, 98,600 XOF fixed levies, about 550,000 XOF handling and registration.",
    sourceUrl: "https://www.adtranslogistics.com/guides/dedouanement-vehicule-benin-2026",
    lastCheckedOn: "2026-10-09",
  },
};

export type LandedEstimate = {
  cif: Range;
  duties: Range;
  /** Freight + US pickup + export paperwork + any cargo-tracking note fee. */
  shipping: Range;
  fixedFees: number;
  portClearing: Range | null;
  /** Everything, from the buyer's pocket to the car out of the port. */
  landed: Range;
};

const round0 = (n: number) => Math.round(n);

/**
 * Low: low freight, low duty rate, low port charges. High: the high of each.
 * CIF = car price + insurance + ocean freight.
 */
export function landedEstimate(input: {
  vehiclePrice: number;
  totalBeforeShipping: number;
  freight: Range;
  usPickup: Range;
  exportPaperwork: Range;
  trackingFee?: number;
  rates: LandedCostRates;
}): LandedEstimate {
  const { rates } = input;
  const insurance = input.vehiclePrice * (rates.insurancePct / 100);
  const cif = { min: input.vehiclePrice + insurance + input.freight.min, max: input.vehiclePrice + insurance + input.freight.max };
  const duties = { min: cif.min * (rates.dutiesPct.min / 100), max: cif.max * (rates.dutiesPct.max / 100) };
  const tracking = input.trackingFee ?? 0;
  const shipping = {
    min: input.freight.min + input.usPickup.min + input.exportPaperwork.min + tracking,
    max: input.freight.max + input.usPickup.max + input.exportPaperwork.max + tracking,
  };
  const pc = rates.portClearing;
  const landed = {
    min: input.totalBeforeShipping + shipping.min + duties.min + rates.fixedFeesUsd + (pc?.min ?? 0),
    max: input.totalBeforeShipping + shipping.max + duties.max + rates.fixedFeesUsd + (pc?.max ?? 0),
  };
  const r = (x: Range): Range => ({ min: round0(x.min), max: round0(x.max) });
  return {
    cif: r(cif),
    duties: r(duties),
    shipping: r(shipping),
    fixedFees: round0(rates.fixedFeesUsd),
    portClearing: pc ? r(pc) : null,
    landed: r(landed),
  };
}

// ---------------------------------------------------------------------------
// The landed_cost_rates row <-> LandedCostRates, and the admin form
// ---------------------------------------------------------------------------

/** A public.landed_cost_rates row as Supabase returns it (numerics may be strings). */
export type LandedCostRow = {
  country: string;
  duties_min_pct: number | string;
  duties_max_pct: number | string;
  insurance_pct: number | string;
  fixed_fees_usd: number | string;
  port_clearing_min_usd: number | string | null;
  port_clearing_max_usd: number | string | null;
  source_note: string;
  source_url: string | null;
  last_checked_on: string;
};

export function ratesFromRow(row: LandedCostRow): LandedCostRates {
  const n = Number;
  return {
    dutiesPct: { min: n(row.duties_min_pct), max: n(row.duties_max_pct) },
    insurancePct: n(row.insurance_pct),
    fixedFeesUsd: n(row.fixed_fees_usd),
    portClearing:
      row.port_clearing_min_usd == null || row.port_clearing_max_usd == null
        ? null
        : { min: n(row.port_clearing_min_usd), max: n(row.port_clearing_max_usd) },
    sourceNote: row.source_note,
    sourceUrl: row.source_url,
    lastCheckedOn: row.last_checked_on,
  };
}

export function isLandedCountry(v: unknown): v is LandedCountry {
  return v === "NG" || v === "GH" || v === "TG" || v === "BJ";
}

export type ParsedLandedForm =
  | {
      ok: true;
      row: {
        duties_min_pct: number;
        duties_max_pct: number;
        insurance_pct: number;
        fixed_fees_usd: number;
        port_clearing_min_usd: number | null;
        port_clearing_max_usd: number | null;
        source_note: string;
        source_url: string | null;
      };
    }
  | { ok: false; error: string };

function num(raw: unknown): number | null {
  const t = typeof raw === "string" ? raw.trim().replace(/[%$,\s]/g, "") : "";
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

/**
 * Validates the admin form. Percents 0–200 (two decimals), dollars
 * 0–100,000; port & clearing either both blank (not included) or both set,
 * low <= high; a source note is required; a link must be https.
 */
export function parseLandedForm(get: (name: string) => unknown): ParsedLandedForm {
  const dMin = num(get("duties_min_pct"));
  const dMax = num(get("duties_max_pct"));
  const ins = num(get("insurance_pct"));
  const fixed = num(get("fixed_fees_usd"));
  if (dMin === null || dMax === null) return { ok: false, error: "Duties and taxes: enter both percents." };
  if (dMin > 200 || dMax > 200) return { ok: false, error: "Duties and taxes: must be 0–200%." };
  if (dMax < dMin) return { ok: false, error: "Duties and taxes: the high percent must be at least the low one." };
  if (ins === null || ins > 20) return { ok: false, error: "Insurance: enter a percent from 0 to 20." };
  if (fixed === null || fixed > 100_000) return { ok: false, error: "Fixed fees: enter a dollar amount (0 if none)." };

  const pcMinRaw = String(get("port_clearing_min_usd") ?? "").trim();
  const pcMaxRaw = String(get("port_clearing_max_usd") ?? "").trim();
  let pcMin: number | null = null;
  let pcMax: number | null = null;
  if (pcMinRaw !== "" || pcMaxRaw !== "") {
    pcMin = num(pcMinRaw);
    pcMax = num(pcMaxRaw);
    if (pcMin === null || pcMax === null) {
      return { ok: false, error: "Port & clearing: enter both amounts, or leave both blank if not known." };
    }
    if (pcMin > 100_000 || pcMax > 100_000) return { ok: false, error: "Port & clearing: too large." };
    if (pcMax < pcMin) return { ok: false, error: "Port & clearing: the high amount must be at least the low one." };
  }

  const note = String(get("source_note") ?? "").trim();
  if (note.length === 0) return { ok: false, error: "Say where these figures come from." };
  if (note.length > 2000) return { ok: false, error: "Source note: 2,000 characters at most." };
  const url = String(get("source_url") ?? "").trim();
  if (url !== "" && !/^https:\/\/\S+$/.test(url)) return { ok: false, error: "Source link: must start with https://." };

  const r2 = (x: number) => Math.round(x * 100) / 100;
  return {
    ok: true,
    row: {
      duties_min_pct: r2(dMin),
      duties_max_pct: r2(dMax),
      insurance_pct: r2(ins),
      fixed_fees_usd: r2(fixed),
      port_clearing_min_usd: pcMin === null ? null : r2(pcMin),
      port_clearing_max_usd: pcMax === null ? null : r2(pcMax),
      source_note: note,
      source_url: url === "" ? null : url,
    },
  };
}
