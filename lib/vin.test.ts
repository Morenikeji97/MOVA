import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BLOCKED_SAMPLE_VINS,
  computeCheckDigit,
  isValidVin,
  validateVin,
  VIN_ERROR_MESSAGE,
} from "./vin.ts";

// ---------------------------------------------------------------------------
// The four cases called out when this was specified
// ---------------------------------------------------------------------------

test("accepts SALAG2D47CA628413 (real 2012 Land Rover LR4)", () => {
  assert.deepEqual(validateVin("SALAG2D47CA628413"), {
    ok: true,
    vin: "SALAG2D47CA628413",
  });
});

test("blocks 1HGCM82633A004352 (published Honda sample VIN)", () => {
  assert.deepEqual(validateVin("1HGCM82633A004352"), {
    ok: false,
    reason: "blocked_sample",
  });
});

test("the blocked Honda sample VIN is structurally valid — only the blocklist catches it", () => {
  // Worth asserting: it has a correct ISO 3779 check digit, so no amount of
  // structural validation would ever reject it. That's the whole reason the
  // blocklist exists.
  assert.equal(computeCheckDigit("1HGCM82633A004352"), "1HGCM82633A004352"[8]);
});

test("rejects a VIN with a bad check digit", () => {
  // SALAG2D47CA628413 with the North-American WMI '1' swapped in, so the
  // check digit is enforced, and a serial digit altered so it fails.
  const vin = "1FMCU9J92KUA12345";
  assert.notEqual(computeCheckDigit(vin), vin[8]);
  assert.deepEqual(validateVin(vin), { ok: false, reason: "check_digit" });
});

test("rejects a VIN containing I, O or Q", () => {
  assert.deepEqual(validateVin("1HGCM8263IA004352"), {
    ok: false,
    reason: "charset",
  });
  assert.deepEqual(validateVin("SALAG2D47CA62O413"), {
    ok: false,
    reason: "charset",
  });
  assert.deepEqual(validateVin("SALAG2D47CA62Q413"), {
    ok: false,
    reason: "charset",
  });
});

// ---------------------------------------------------------------------------
// Length and normalisation
// ---------------------------------------------------------------------------

test("rejects anything that isn't exactly 17 characters", () => {
  assert.deepEqual(validateVin("SALAG2D47CA62841"), { ok: false, reason: "length" });
  assert.deepEqual(validateVin("SALAG2D47CA6284133"), { ok: false, reason: "length" });
  assert.deepEqual(validateVin(""), { ok: false, reason: "length" });
});

test("normalises case and surrounding whitespace before validating", () => {
  assert.deepEqual(validateVin("  salag2d47ca628413 "), {
    ok: true,
    vin: "SALAG2D47CA628413",
  });
});

// ---------------------------------------------------------------------------
// Pattern-based placeholder rejection
// ---------------------------------------------------------------------------

test("rejects all-same-character VINs", () => {
  assert.deepEqual(validateVin("AAAAAAAAAAAAAAAAA"), {
    ok: false,
    reason: "repeated_character",
  });
  // 00000000000000000 and 11111111111111111 are also on the blocklist, so
  // they report as blocked_sample — asserted separately below.
  assert.deepEqual(validateVin("22222222222222222"), {
    ok: false,
    reason: "repeated_character",
  });
});

test("rejects sequential VINs", () => {
  assert.deepEqual(validateVin("23456789ABCDEFGHJ"), {
    ok: false,
    reason: "sequential",
  });
  assert.deepEqual(validateVin("ZYXWVUTSRPNMLKJHG"), {
    ok: false,
    reason: "sequential",
  });
});

test("a short ascending run inside a genuine VIN is not treated as sequential", () => {
  // Real VINs do contain short consecutive runs; only a run covering most of
  // the VIN is placeholder data.
  assert.equal(isValidVin("SALAG2D47CA628413"), true);
  assert.equal(isValidVin("WBA3A5C55CF256691".replace("WBA", "SAL")), true);
});

test("every blocklist entry is rejected, and reports as blocked_sample when 17 chars", () => {
  for (const vin of BLOCKED_SAMPLE_VINS) {
    assert.equal(isValidVin(vin), false, `${vin} should be rejected`);
    if (vin.length === 17) {
      const result = validateVin(vin);
      assert.equal(result.ok, false, `${vin} should be rejected`);
      if (!result.ok) {
        assert.equal(
          result.reason,
          "blocked_sample",
          `${vin} should report blocked_sample`,
        );
      }
    }
  }
});

test("the blocklist is matched case-insensitively", () => {
  assert.deepEqual(validateVin("1hgcm82633a004352"), {
    ok: false,
    reason: "blocked_sample",
  });
});

// ---------------------------------------------------------------------------
// Check digit is North-America-only
// ---------------------------------------------------------------------------

test("the check digit is enforced for North American WMIs (first char 1-5)", () => {
  const bad = "1HGCM82633A004353"; // Honda sample with the last digit bumped
  assert.deepEqual(validateVin(bad), { ok: false, reason: "check_digit" });
});

test("the check digit is not enforced outside North America", () => {
  // A European WMI whose position-9 character is not a valid NA check digit
  // still passes — the digit is optional in those regions and plenty of
  // legitimately imported vehicles fail it. (SALAG2D47CA628413 happens to
  // have a valid one, so it can't demonstrate this.)
  const vin = "WAUZZZ8V7JA123456";
  assert.notEqual(computeCheckDigit(vin), vin[8]);
  assert.equal(validateVin(vin).ok, true);
});

test("the 2012 LR4 VIN happens to carry a valid check digit too", () => {
  assert.equal(computeCheckDigit("SALAG2D47CA628413"), "SALAG2D47CA628413"[8]);
});

test("computeCheckDigit writes a remainder of 10 as X", () => {
  assert.equal(computeCheckDigit("1HGBH41JXMN109186"), "X");
});

// ---------------------------------------------------------------------------
// Seller-facing copy
// ---------------------------------------------------------------------------

test("the seller-facing message is the one specified", () => {
  assert.equal(
    VIN_ERROR_MESSAGE,
    "This VIN failed validation. Check it against your title.",
  );
});
