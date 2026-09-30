import { test } from "node:test";
import assert from "node:assert/strict";
import { escrowFeeEstimate, feeBreakdown, MOVA_FEE_RATE, round2 } from "./fees.ts";

// ---------------------------------------------------------------------------
// escrowFeeEstimate — tier boundaries and minimums
// ---------------------------------------------------------------------------

test("escrow: tier 1 applies its $50 minimum", () => {
  assert.equal(escrowFeeEstimate(1_000), 50); // 2.6% = $26 -> min $50
});

test("escrow: tier 1 at exactly $5,000 is 2.6%", () => {
  assert.equal(escrowFeeEstimate(5_000), 130);
});

test("escrow: $5,000.01 moves to tier 2 (2.4%, min $130)", () => {
  assert.equal(escrowFeeEstimate(5_000.01), 130); // 2.4% = $120 -> min $130
});

test("escrow: tier 2 rate above its minimum", () => {
  assert.equal(escrowFeeEstimate(25_000), 600);
});

test("escrow: tier 2 at exactly $50,000", () => {
  assert.equal(escrowFeeEstimate(50_000), 1_200);
});

test("escrow: $50,000.01 moves to tier 3 (1.9%, min $1,200)", () => {
  assert.equal(escrowFeeEstimate(50_000.01), 1_200); // 1.9% = $950 -> min $1,200
});

test("escrow: tier 3 rate above its minimum", () => {
  assert.equal(escrowFeeEstimate(100_000), 1_900);
});

test("escrow: tier 3 at exactly $200,000", () => {
  assert.equal(escrowFeeEstimate(200_000), 3_800);
});

test("escrow: above $200,000 there is no published estimate", () => {
  assert.equal(escrowFeeEstimate(200_000.01), null);
});

// ---------------------------------------------------------------------------
// feeBreakdown
// ---------------------------------------------------------------------------

test("ShipMova fee is 8%", () => {
  assert.equal(MOVA_FEE_RATE, 0.08);
});

test("buyer pays full: 8% upfront, nothing from the seller's payout", () => {
  const b = feeBreakdown(25_000, "buyer_pays_full");
  assert.equal(b.fullFee, 2_000);
  assert.equal(b.buyerFee, 2_000);
  assert.equal(b.sellerFeeFromPayout, 0);
  assert.equal(b.buyerRatePct, 8);
  assert.equal(b.escrowFee, 600);
  assert.equal(b.totalBeforeShipping, 27_600);
  assert.equal(b.split, false);
});

test("split: buyer pays 4%, seller's 4% comes out of the escrow payout", () => {
  const b = feeBreakdown(25_000, "split");
  assert.equal(b.fullFee, 2_000);
  assert.equal(b.buyerFee, 1_000);
  assert.equal(b.sellerFeeFromPayout, 1_000);
  assert.equal(b.buyerRatePct, 4);
  assert.equal(b.escrowFee, 600); // escrow is the buyer's either way
  assert.equal(b.totalBeforeShipping, 26_600);
  assert.equal(b.split, true);
});

test("an odd split rounds to cents and still adds up to the full fee", () => {
  const b = feeBreakdown(12_345.67, "split");
  assert.equal(b.fullFee, 987.65);
  assert.equal(round2(b.buyerFee + b.sellerFeeFromPayout), b.fullFee);
});

test("above the escrow tiers the total excludes escrow rather than guessing", () => {
  const b = feeBreakdown(250_000, "buyer_pays_full");
  assert.equal(b.escrowFee, null);
  assert.equal(b.totalBeforeShipping, 270_000);
});
