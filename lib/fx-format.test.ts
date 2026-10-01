import { test } from "node:test";
import assert from "node:assert/strict";
import { currenciesFor, formatFxUpdated, formatLocal, parseErApiResponse } from "./fx-format.ts";

const OK = {
  result: "success",
  base_code: "USD",
  time_last_update_unix: 1790812951,
  rates: { USD: 1, NGN: 1328.645734, GHS: 11.706717, XOF: 578.339132, EUR: 0.9 },
};

test("a successful response keeps just the three currencies and the provider's update time", () => {
  assert.deepEqual(parseErApiResponse(OK), {
    rates: { NGN: 1328.645734, GHS: 11.706717, XOF: 578.339132 },
    updatedAt: "2026-10-01T00:02:31.000Z",
  });
});

test("an error, a different base, or a missing or bad rate is rejected", () => {
  assert.equal(parseErApiResponse({ ...OK, result: "error" }), null);
  assert.equal(parseErApiResponse({ ...OK, base_code: "EUR" }), null);
  assert.equal(parseErApiResponse({ ...OK, rates: { NGN: 1300, GHS: 11 } }), null);
  assert.equal(parseErApiResponse({ ...OK, rates: { ...OK.rates, XOF: 0 } }), null);
  assert.equal(parseErApiResponse({ ...OK, rates: { ...OK.rates, NGN: "1300" } }), null);
  assert.equal(parseErApiResponse({ ...OK, time_last_update_unix: undefined }), null);
  assert.equal(parseErApiResponse(null), null);
  assert.equal(parseErApiResponse("nope"), null);
});

test("local amounts are rounded to three significant figures", () => {
  assert.equal(formatLocal(18_450, "NGN", 1328.645734), "≈ ₦24,500,000");
  assert.equal(formatLocal(18_450, "GHS", 11.706717), "≈ GH₵216,000");
  assert.equal(formatLocal(18_450, "XOF", 578.339132), "≈ CFA 10,700,000");
});

test("the update time is shown in UTC", () => {
  assert.equal(formatFxUpdated("2026-10-01T00:02:31.000Z"), "1 Oct, 00:02 UTC");
  assert.equal(formatFxUpdated("2026-12-31T23:59:00.000Z"), "31 Dec, 23:59 UTC");
});

test("the buyer's own currency comes first", () => {
  assert.deepEqual(currenciesFor("GH"), ["GHS", "NGN", "XOF"]);
  assert.deepEqual(currenciesFor("BJ"), ["XOF", "NGN", "GHS"]);
  assert.deepEqual(currenciesFor("NG"), ["NGN", "GHS", "XOF"]);
  assert.deepEqual(currenciesFor(null), ["NGN", "GHS", "XOF"]);
  assert.deepEqual(currenciesFor("US"), ["NGN", "GHS", "XOF"]);
});
