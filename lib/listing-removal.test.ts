import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVE_BUYER_MESSAGE,
  canSellerArchive,
  hasActiveBuyer,
  type PurchaseRequestSnapshot,
} from "./listing-removal.ts";
import type { VehicleStatus } from "../types/database.ts";

const noRequests: PurchaseRequestSnapshot[] = [];

function pr(
  status: PurchaseRequestSnapshot["status"],
  fee: PurchaseRequestSnapshot["mova_fee_payment_status"] = "pending",
): PurchaseRequestSnapshot {
  return { status, mova_fee_payment_status: fee };
}

// ---------------------------------------------------------------------------
// Which statuses a seller may withdraw from
// ---------------------------------------------------------------------------

test("a seller may archive a draft, pending, approved or rejected listing", () => {
  for (const status of ["draft", "pending_review", "approved", "rejected"] as VehicleStatus[]) {
    assert.deepEqual(
      canSellerArchive({ status, purchaseRequests: noRequests }),
      { allowed: true },
      `${status} should be archivable`,
    );
  }
});

test("a seller may not archive a sold listing", () => {
  const check = canSellerArchive({ status: "sold", purchaseRequests: noRequests });
  assert.equal(check.allowed, false);
  if (!check.allowed) assert.equal(check.reason, "wrong_status");
});

test("a seller may not re-archive an already-archived listing", () => {
  const check = canSellerArchive({ status: "archived", purchaseRequests: noRequests });
  assert.equal(check.allowed, false);
  if (!check.allowed) assert.equal(check.reason, "wrong_status");
});

// ---------------------------------------------------------------------------
// Active buyer
// ---------------------------------------------------------------------------

test("an open reservation blocks removal, whatever the fee status", () => {
  for (const status of ["submitted", "under_review", "verified"] as const) {
    assert.equal(hasActiveBuyer([pr(status)]), true, `${status} should block`);
  }
});

test("closed reservations don't block removal", () => {
  for (const status of ["rejected", "cancelled", "expired", "completed"] as const) {
    assert.equal(hasActiveBuyer([pr(status)]), false, `${status} should not block`);
  }
});

test("a paid fee blocks removal even if the request's status has moved on", () => {
  assert.equal(hasActiveBuyer([pr("cancelled", "paid")]), true);
  assert.equal(hasActiveBuyer([pr("expired", "pending_manual_verification")]), true);
});

test("a paid fee on a completed sale does not block removal", () => {
  assert.equal(hasActiveBuyer([pr("completed", "paid")]), false);
});

test("a rejected bank transfer does not count as money in play", () => {
  assert.equal(hasActiveBuyer([pr("cancelled", "bank_transfer_rejected")]), false);
});

test("one active request among several closed ones still blocks removal", () => {
  assert.equal(
    hasActiveBuyer([pr("cancelled"), pr("expired"), pr("under_review"), pr("rejected")]),
    true,
  );
});

test("no reservations at all means nothing blocks removal", () => {
  assert.equal(hasActiveBuyer(noRequests), false);
});

test("an approved listing with an active buyer is blocked with the specified message", () => {
  const check = canSellerArchive({
    status: "approved",
    purchaseRequests: [pr("verified", "paid")],
  });
  assert.equal(check.allowed, false);
  if (!check.allowed) {
    assert.equal(check.reason, "active_buyer");
    assert.equal(check.message, ACTIVE_BUYER_MESSAGE);
  }
});

test("the active-buyer message is the one specified", () => {
  assert.equal(
    ACTIVE_BUYER_MESSAGE,
    "This car has an active buyer, contact ShipMova on WhatsApp to cancel.",
  );
});

test("status is checked before the buyer state", () => {
  // A sold listing with a paid request reports wrong_status, not active_buyer:
  // "it already sold" is the more useful thing to tell the seller.
  const check = canSellerArchive({
    status: "sold",
    purchaseRequests: [pr("completed", "paid")],
  });
  assert.equal(check.allowed, false);
  if (!check.allowed) assert.equal(check.reason, "wrong_status");
});
