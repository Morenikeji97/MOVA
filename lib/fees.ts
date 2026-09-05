import type { FeeResponsibility } from "@/types/database";

/** MOVA's service fee, as a fraction of the vehicle price. */
export const MOVA_FEE_RATE = 0.08;

/** Round to whole cents, avoiding binary-float drift (e.g. 493.8000000001). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface FeeBreakdown {
  vehiclePrice: number;
  /** The full 8% fee, before any split. Stored as purchase_requests.mova_fee_usd. */
  fullFee: number;
  /** What the buyer pays: the full fee, or half of it when split 50/50. */
  buyerFee: number;
  /** The buyer-facing fee rate as a whole-number percent — 8, or 4 when split. */
  buyerRatePct: number;
  /** Vehicle price + the buyer's fee portion. This is "the price" shown to buyers. */
  total: number;
  split: boolean;
}

/**
 * Split MOVA's service fee for a given vehicle price.
 *
 * `buyer_pays_full` — the buyer pays the whole 8%.
 * `split`           — buyer and seller each cover half (the buyer sees 4%).
 *
 * Either way the seller receives their full asking price; the fee rides on top.
 */
export function feeBreakdown(
  vehiclePrice: number,
  feeResponsibility: FeeResponsibility,
): FeeBreakdown {
  const price = round2(vehiclePrice);
  const fullFee = round2(price * MOVA_FEE_RATE);
  const split = feeResponsibility === "split";
  const buyerFee = split ? round2(fullFee / 2) : fullFee;
  return {
    vehiclePrice: price,
    fullFee,
    buyerFee,
    buyerRatePct: split ? 4 : 8,
    total: round2(price + buyerFee),
    split,
  };
}
