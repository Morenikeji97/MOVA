import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildReferralLink,
  payoutBatchesTriggered,
  shouldFlagForReview,
  normalizeEmailForMatching,
  normalizePhone,
  ipSubnetKey,
  detectSelfReferralSignals,
  determinePayoutMethod,
  REFERRAL_FLAG_THRESHOLD,
  type SignupSignals,
} from "./referrals.ts";

test("buildReferralLink builds a /signup?ref= link from origin + code", () => {
  assert.equal(
    buildReferralLink("https://shipmova.com/", "ABC12345"),
    "https://shipmova.com/signup?ref=ABC12345",
  );
});

// ---------------------------------------------------------------------------
// payoutBatchesTriggered — fires exactly at multiples of 10
// ---------------------------------------------------------------------------

test("payoutBatchesTriggered fires exactly on crossing a multiple of 10", () => {
  assert.equal(payoutBatchesTriggered(9, 10), 1, "9 -> 10 crosses the first batch");
  assert.equal(payoutBatchesTriggered(0, 9), 0, "0 -> 9 stays below the first batch");
  assert.equal(payoutBatchesTriggered(10, 11), 0, "10 -> 11 doesn't re-trigger");
  assert.equal(payoutBatchesTriggered(19, 20), 1, "19 -> 20 crosses the second batch");
  assert.equal(payoutBatchesTriggered(20, 21), 0, "just past a batch triggers nothing");
});

test("payoutBatchesTriggered handles crossing more than one batch in a single jump", () => {
  assert.equal(payoutBatchesTriggered(8, 30), 3);
});

test("payoutBatchesTriggered never returns negative for an out-of-order call", () => {
  assert.equal(payoutBatchesTriggered(20, 15), 0);
});

// ---------------------------------------------------------------------------
// shouldFlagForReview
// ---------------------------------------------------------------------------

test("shouldFlagForReview flags strictly more than the threshold, not exactly it", () => {
  assert.equal(shouldFlagForReview(REFERRAL_FLAG_THRESHOLD), false);
  assert.equal(shouldFlagForReview(REFERRAL_FLAG_THRESHOLD + 1), true);
});

// ---------------------------------------------------------------------------
// normalization helpers
// ---------------------------------------------------------------------------

test("normalizeEmailForMatching strips +tags and dots from the local part", () => {
  assert.equal(
    normalizeEmailForMatching("john.doe+promo@Gmail.com"),
    normalizeEmailForMatching("johndoe@gmail.com"),
  );
});

test("normalizeEmailForMatching returns null for an unparseable value", () => {
  assert.equal(normalizeEmailForMatching("not-an-email"), null);
  assert.equal(normalizeEmailForMatching(null), null);
});

test("normalizePhone compares digits only", () => {
  assert.equal(normalizePhone("+1 (555) 123-4567"), normalizePhone("15551234567"));
  assert.equal(normalizePhone(null), null);
});

test("ipSubnetKey matches on the /24 for IPv4 and ignores the last octet", () => {
  assert.equal(ipSubnetKey("102.89.23.5"), ipSubnetKey("102.89.23.240"));
  assert.notEqual(ipSubnetKey("102.89.23.5"), ipSubnetKey("102.89.24.5"));
});

test("ipSubnetKey returns null for unparseable input", () => {
  assert.equal(ipSubnetKey("not-an-ip"), null);
  assert.equal(ipSubnetKey(null), null);
});

// ---------------------------------------------------------------------------
// detectSelfReferralSignals — the fraud guard
// ---------------------------------------------------------------------------

function signals(overrides: Partial<SignupSignals> = {}): SignupSignals {
  return {
    email: null,
    phone: null,
    deviceFingerprint: null,
    ip: null,
    paymentFingerprint: null,
    ...overrides,
  };
}

test("a genuinely distinct referrer/referred pair is not blocked (qualifying referral case)", () => {
  const referrer = signals({
    email: "amaka@example.com",
    phone: "+2348012345678",
    deviceFingerprint: "device-aaa",
    ip: "197.210.1.1",
    paymentFingerprint: "pm_fingerprint_aaa",
  });
  const referred = signals({
    email: "chidi@example.com",
    phone: "+2348099999999",
    deviceFingerprint: "device-bbb",
    ip: "41.203.6.9",
    paymentFingerprint: "pm_fingerprint_bbb",
  });
  const result = detectSelfReferralSignals(referrer, referred);
  assert.equal(result.blocked, false);
  assert.deepEqual(result.signals, {
    emailPatternMatch: false,
    phoneMatch: false,
    paymentFingerprintMatch: false,
    deviceFingerprintMatch: false,
    ipSubnetMatch: false,
  });
});

test("self-referral fraud guard: matching email alias blocks crediting", () => {
  const referrer = signals({ email: "amaka+one@gmail.com" });
  const referred = signals({ email: "amaka+two@gmail.com" });
  const result = detectSelfReferralSignals(referrer, referred);
  assert.equal(result.blocked, true);
  assert.equal(result.signals.emailPatternMatch, true);
});

test("self-referral fraud guard: matching phone number blocks crediting", () => {
  const referrer = signals({ email: "a@example.com", phone: "5551234567" });
  const referred = signals({ email: "b@example.com", phone: "555-123-4567" });
  const result = detectSelfReferralSignals(referrer, referred);
  assert.equal(result.blocked, true);
  assert.equal(result.signals.phoneMatch, true);
});

test("self-referral fraud guard: matching device fingerprint blocks crediting", () => {
  const referrer = signals({ deviceFingerprint: "shared-device" });
  const referred = signals({ deviceFingerprint: "shared-device" });
  const result = detectSelfReferralSignals(referrer, referred);
  assert.equal(result.blocked, true);
  assert.equal(result.signals.deviceFingerprintMatch, true);
});

test("self-referral fraud guard: matching IP subnet blocks crediting", () => {
  const referrer = signals({ ip: "102.89.23.5" });
  const referred = signals({ ip: "102.89.23.240" });
  const result = detectSelfReferralSignals(referrer, referred);
  assert.equal(result.blocked, true);
  assert.equal(result.signals.ipSubnetMatch, true);
});

test("self-referral fraud guard: matching Stripe payment-method fingerprint blocks crediting", () => {
  const referrer = signals({ paymentFingerprint: "pm_fingerprint_shared" });
  const referred = signals({ paymentFingerprint: "pm_fingerprint_shared" });
  const result = detectSelfReferralSignals(referrer, referred);
  assert.equal(result.blocked, true);
  assert.equal(result.signals.paymentFingerprintMatch, true);
});

test("a missing signal on either side never counts as a match", () => {
  const referrer = signals({ phone: null, ip: null, deviceFingerprint: null });
  const referred = signals({ phone: null, ip: null, deviceFingerprint: null });
  const result = detectSelfReferralSignals(referrer, referred);
  assert.equal(result.blocked, false);
});

// ---------------------------------------------------------------------------
// determinePayoutMethod
// ---------------------------------------------------------------------------

test("determinePayoutMethod: an explicit US country routes to Stripe regardless of role", () => {
  assert.equal(determinePayoutMethod("buyer", "US"), "stripe_transfer");
  assert.equal(determinePayoutMethod("seller", "United States"), "stripe_transfer");
});

test("determinePayoutMethod: an explicit non-US country routes to bank transfer regardless of role", () => {
  assert.equal(determinePayoutMethod("seller", "Nigeria"), "bank_transfer");
});

test("determinePayoutMethod: no country on file falls back to the role default", () => {
  assert.equal(determinePayoutMethod("seller", null), "stripe_transfer");
  assert.equal(determinePayoutMethod("buyer", null), "bank_transfer");
});
