import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getAutoReleaseStatus,
  AUTO_RELEASE_WINDOW_HOURS,
  type AutoReleaseInput,
} from "./auto-release.ts";

const NOW = new Date("2026-01-10T12:00:00.000Z");

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();
}

function baseInput(overrides: Partial<AutoReleaseInput> = {}): AutoReleaseInput {
  return {
    feePaymentRequestedAt: null,
    movaFeePaymentStatus: "pending",
    bankTransferReviewedAt: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// The three scenarios required by the feature spec
// ---------------------------------------------------------------------------

test("card payment: past 24h with no payment is due for release", () => {
  const status = getAutoReleaseStatus(
    baseInput({ feePaymentRequestedAt: hoursAgo(25), movaFeePaymentStatus: "pending" }),
    NOW,
  );
  assert.equal(status.state, "due_for_release");
});

test("bank transfer: proof uploaded at hour 23 never expires, even 48h+ of admin inaction later", () => {
  // The buyer uploaded proof with 1 hour to spare — mova_fee_payment_status
  // moved to 'pending_manual_verification' at that point (0014's trigger).
  const input = baseInput({
    feePaymentRequestedAt: hoursAgo(23 + 48),
    movaFeePaymentStatus: "pending_manual_verification",
  });
  const status = getAutoReleaseStatus(input, NOW);
  assert.equal(status.state, "paused");
  assert.equal(status.deadline, null);
});

test("bank transfer: no proof uploaded expires at 24h, same as card", () => {
  const status = getAutoReleaseStatus(
    baseInput({ feePaymentRequestedAt: hoursAgo(25), movaFeePaymentStatus: "pending" }),
    NOW,
  );
  assert.equal(status.state, "due_for_release");
});

// ---------------------------------------------------------------------------
// Edge cases that fall out of the rule but aren't explicitly spelled out
// ---------------------------------------------------------------------------

test("invoice not yet sent: no clock running", () => {
  const status = getAutoReleaseStatus(baseInput({ feePaymentRequestedAt: null }), NOW);
  assert.equal(status.state, "not_started");
});

test("well within the window: active, not flagged", () => {
  const status = getAutoReleaseStatus(
    baseInput({ feePaymentRequestedAt: hoursAgo(1) }),
    NOW,
  );
  assert.equal(status.state, "active");
});

test("within the expiring-soon threshold: flagged but not yet released", () => {
  const status = getAutoReleaseStatus(
    baseInput({ feePaymentRequestedAt: hoursAgo(AUTO_RELEASE_WINDOW_HOURS - 2) }),
    NOW,
  );
  assert.equal(status.state, "expiring_soon");
  assert.ok(status.hoursRemaining != null && status.hoursRemaining <= 3);
});

test("exactly at the deadline is due for release", () => {
  const status = getAutoReleaseStatus(
    baseInput({ feePaymentRequestedAt: hoursAgo(AUTO_RELEASE_WINDOW_HOURS) }),
    NOW,
  );
  assert.equal(status.state, "due_for_release");
});

test("rejected bank transfer restarts the clock from the rejection time, not the stale invoice time", () => {
  // Invoice was sent 40h ago (long past a normal deadline), but admin
  // rejected the buyer's proof only 1h ago — the buyer gets a fresh window
  // from the rejection, not an instant expiry off the old invoice timestamp.
  const freshRejection = getAutoReleaseStatus(
    baseInput({
      feePaymentRequestedAt: hoursAgo(40),
      movaFeePaymentStatus: "bank_transfer_rejected",
      bankTransferReviewedAt: hoursAgo(1),
    }),
    NOW,
  );
  assert.equal(freshRejection.state, "active");

  const staleRejection = getAutoReleaseStatus(
    baseInput({
      feePaymentRequestedAt: hoursAgo(40),
      movaFeePaymentStatus: "bank_transfer_rejected",
      bankTransferReviewedAt: hoursAgo(25),
    }),
    NOW,
  );
  assert.equal(staleRejection.state, "due_for_release");
});

test("paid reservations are out of scope for callers (documented, not enforced here)", () => {
  // getAutoReleaseStatus doesn't special-case 'paid' — callers are expected
  // to only invoke it for unpaid, open reservations. A 'paid' row with an
  // old feePaymentRequestedAt would otherwise read as due_for_release, which
  // is why the release route filters on mova_fee_payment_status != 'paid'
  // before ever calling this function.
  const status = getAutoReleaseStatus(
    baseInput({ feePaymentRequestedAt: hoursAgo(25), movaFeePaymentStatus: "paid" }),
    NOW,
  );
  assert.equal(status.state, "due_for_release");
});
