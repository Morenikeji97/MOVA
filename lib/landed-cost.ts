/**
 * ShipMova — ESTIMATED Nigerian import charges and landed cost for the
 * listing page. Not a quote, and ShipMova does not handle customs: the
 * buyer's clearing agent pays the real figures, which Nigeria Customs works
 * out from its own valuation of the car (not the price paid).
 *
 * Rates as published for 2026 (Precebol Logistics; legit.ng, 27 Aug 2026),
 * after the 1 July 2026 change that cut the NAC levy on used cars from 15%
 * to 5% and added an engine-size green tax. Re-check with clearing agents
 * before launch and whenever Customs announces changes.
 *
 *   Import duty        20%   of CIF
 *   NAC levy (used)     5%   of CIF
 *   Green tax        0/2/4%  of CIF  (<2.0L / 2.0–3.9L / 4.0L+)
 *   Surcharge           7%   of the import duty
 *   ETLS levy         0.5%   of CIF
 *   Customs FOB charge  4%   of FOB  (Customs has applied 1% CISS or 4% FOB
 *                                     inconsistently since Aug 2025; we use
 *                                     the higher figure so the estimate
 *                                     doesn't come in low)
 *   VAT               7.5%   of CIF + every charge above
 *
 * All figures are USD.
 */

import type { Range } from "./shipping-estimates.ts";

export const NG_IMPORT_DUTY_RATE = 0.2;
export const NG_NAC_LEVY_RATE = 0.05;
export const NG_SURCHARGE_RATE_OF_DUTY = 0.07;
export const NG_ETLS_RATE = 0.005;
export const NG_FOB_CHARGE_RATE = 0.04;
export const NG_VAT_RATE = 0.075;

/** Marine insurance, as a share of the car price, for the CIF value. */
export const INSURANCE_RATE = 0.015;

/** Port, terminal, shipping-line and clearing-agent charges at Lagos — not duty. */
export const LAGOS_PORT_AND_CLEARING: Range = { min: 500, max: 1000 };

export type EngineSize = "under_2l" | "2_to_4l" | "4l_plus";

export const ENGINE_SIZES: readonly { value: EngineSize; label: string; greenTaxRate: number }[] = [
  { value: "under_2l", label: "Under 2.0L", greenTaxRate: 0 },
  { value: "2_to_4l", label: "2.0L – 3.9L", greenTaxRate: 0.02 },
  { value: "4l_plus", label: "4.0L or more", greenTaxRate: 0.04 },
];

/** Used when the buyer hasn't said — the middle band, so we don't guess low. */
export const DEFAULT_ENGINE_SIZE: EngineSize = "2_to_4l";

export function greenTaxRate(engine: EngineSize): number {
  return ENGINE_SIZES.find((e) => e.value === engine)!.greenTaxRate;
}

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
): NigeriaCharges {
  const fob = vehiclePrice;
  const cif = fob + fob * INSURANCE_RATE + freight;
  const importDuty = cif * NG_IMPORT_DUTY_RATE;
  const nacLevy = cif * NG_NAC_LEVY_RATE;
  const greenTax = cif * greenTaxRate(engine);
  const surcharge = importDuty * NG_SURCHARGE_RATE_OF_DUTY;
  const etls = cif * NG_ETLS_RATE;
  const fobCharge = fob * NG_FOB_CHARGE_RATE;
  const beforeVat = importDuty + nacLevy + greenTax + surcharge + etls + fobCharge;
  const vat = (cif + beforeVat) * NG_VAT_RATE;
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
}): NigeriaLandedEstimate {
  const engine = input.engine ?? DEFAULT_ENGINE_SIZE;
  const low = nigeriaCustomsCharges(input.vehiclePrice, input.freight.min, engine);
  const high = nigeriaCustomsCharges(input.vehiclePrice, input.freight.max, engine);
  const shipping: Range = {
    min: input.freight.min + input.usPickup.min + input.exportPaperwork.min,
    max: input.freight.max + input.usPickup.max + input.exportPaperwork.max,
  };
  const landed: Range = {
    min: round0(input.totalBeforeShipping + shipping.min + low.total + LAGOS_PORT_AND_CLEARING.min),
    max: round0(input.totalBeforeShipping + shipping.max + high.total + LAGOS_PORT_AND_CLEARING.max),
  };
  return { low, high, shipping, portAndClearing: LAGOS_PORT_AND_CLEARING, landed };
}
