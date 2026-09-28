import type { FeeResponsibility } from "@/types/database";

/**
 * MOVA — the one place prices are worked out. Every surface that shows a
 * buyer a number (listing cards, the listing page, the dashboard, the Stripe
 * fee checkout, the how-it-works example) goes through feeBreakdown(), so
 * the card, the page and the charge can't disagree.
 */

/** MOVA's service fee, as a fraction of the vehicle price. */
export const MOVA_FEE_RATE = 0.08;

/** New listings default to the buyer paying the whole fee. */
export const DEFAULT_FEE_RESPONSIBILITY: FeeResponsibility = "buyer_pays_full";

/** Badge shown on listings where the seller covers half of MOVA's fee. */
export const SELLER_SPLITS_FEE_BADGE = "Seller splits the fee";

/**
 * Escrow.com's fee on the car price, paid by the buyer, shown as its own
 * "est." line.
 *
 * public rates from escrow.com/cars, Sept 2026, replace with partner rates.
 *
 * Each tier covers car prices up to and including `maxPrice`; the fee is
 * `rate` of the price, but never less than `minFee`. Above the last tier
 * there is no published rate, so the estimate is null.
 */
export const ESCROW_FEE_TIERS: readonly {
  maxPrice: number;
  rate: number;
  minFee: number;
}[] = [
  { maxPrice: 5_000, rate: 0.026, minFee: 50 },
  { maxPrice: 50_000, rate: 0.024, minFee: 130 },
  { maxPrice: 200_000, rate: 0.019, minFee: 1_200 },
];

/** Round to whole cents, avoiding binary-float drift (e.g. 493.8000000001). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Estimated Escrow.com fee for a car price, or null above the highest
 * published tier (Escrow.com quotes those individually).
 */
export function escrowFeeEstimate(vehiclePrice: number): number | null {
  const price = round2(vehiclePrice);
  const tier = ESCROW_FEE_TIERS.find((t) => price <= t.maxPrice);
  if (!tier) return null;
  return round2(Math.max(price * tier.rate, tier.minFee));
}

export interface FeeBreakdown {
  vehiclePrice: number;
  /** The full 8% fee, before any split. Stored as purchase_requests.mova_fee_usd. */
  fullFee: number;
  /** What the buyer pays MOVA upfront: the full fee, or half when split. */
  buyerFee: number;
  /**
   * The seller's half when split, deducted from their escrow payout — the
   * seller pays nothing upfront. 0 when the buyer pays the full fee.
   */
  sellerFeeFromPayout: number;
  /** The buyer-facing fee rate as a whole-number percent — 8, or 4 when split. */
  buyerRatePct: number;
  /** Escrow.com's fee (estimate), paid by the buyer; null above the top tier. */
  escrowFee: number | null;
  /**
   * Car price + the buyer's MOVA fee + the escrow estimate. What the buyer
   * pays before shipping. When escrowFee is null this excludes escrow.
   */
  totalBeforeShipping: number;
  split: boolean;
}

/**
 * Everything a buyer pays for a given car price, before shipping.
 *
 * `buyer_pays_full` — the buyer pays the whole 8% to MOVA.
 * `split`           — the buyer pays 4%; the seller's 4% is deducted from
 *                     their escrow payout, with nothing to pay upfront.
 *
 * Escrow.com's fee is the buyer's either way and sits on its own line.
 */
export function feeBreakdown(
  vehiclePrice: number,
  feeResponsibility: FeeResponsibility,
): FeeBreakdown {
  const price = round2(vehiclePrice);
  const fullFee = round2(price * MOVA_FEE_RATE);
  const split = feeResponsibility === "split";
  const buyerFee = split ? round2(fullFee / 2) : fullFee;
  const escrowFee = escrowFeeEstimate(price);
  return {
    vehiclePrice: price,
    fullFee,
    buyerFee,
    sellerFeeFromPayout: round2(fullFee - buyerFee),
    buyerRatePct: split ? 4 : 8,
    escrowFee,
    totalBeforeShipping: round2(price + buyerFee + (escrowFee ?? 0)),
    split,
  };
}
