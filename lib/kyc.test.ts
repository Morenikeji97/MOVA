import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidNinOrBvn, overallBuyerVerificationStatus } from "./kyc.ts";

test("overall status: verified NIN alone is enough", () => {
  assert.equal(overallBuyerVerificationStatus("verified", "unverified"), "verified");
});

test("overall status: verified BVN alone is enough", () => {
  assert.equal(overallBuyerVerificationStatus("unverified", "verified"), "verified");
});

test("overall status: both verified is still verified", () => {
  assert.equal(overallBuyerVerificationStatus("verified", "verified"), "verified");
});

test("overall status: one failed, the other never attempted stays unverified (still fixable)", () => {
  assert.equal(overallBuyerVerificationStatus("failed", "unverified"), "unverified");
});

test("overall status: both failed is failed", () => {
  assert.equal(overallBuyerVerificationStatus("failed", "failed"), "failed");
});

test("overall status: both unverified stays unverified", () => {
  assert.equal(overallBuyerVerificationStatus("unverified", "unverified"), "unverified");
});

test("overall status: pending on one side with no verified/failed elsewhere stays unverified", () => {
  assert.equal(overallBuyerVerificationStatus("pending", "unverified"), "unverified");
});

test("isValidNinOrBvn: exactly 11 digits passes", () => {
  assert.equal(isValidNinOrBvn("70123456789"), true);
});

test("isValidNinOrBvn: rejects wrong length", () => {
  assert.equal(isValidNinOrBvn("1234567890"), false);
  assert.equal(isValidNinOrBvn("123456789012"), false);
});

test("isValidNinOrBvn: rejects non-digit characters", () => {
  assert.equal(isValidNinOrBvn("7012345678a"), false);
  assert.equal(isValidNinOrBvn("701-234-5678"), false);
});

test("isValidNinOrBvn: rejects empty string", () => {
  assert.equal(isValidNinOrBvn(""), false);
});
