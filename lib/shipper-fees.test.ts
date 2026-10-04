import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SHIPPER_COMMISSION_PCT,
  SHIPPER_FEES_ENABLED,
  SHIPPER_TERMS_VERSION,
  commissionOwed,
} from "./shipping.ts";

// Founder's decision 2026-10-04: no shipper fees at launch. Changing any of
// these is a business decision, so it must also change these tests.

test("shippers pay nothing: commission is 0% and fees are off", () => {
  assert.equal(SHIPPER_COMMISSION_PCT, 0);
  assert.equal(SHIPPER_FEES_ENABLED, false);
  assert.equal(commissionOwed(1835), 0);
});

test("new shippers sign the no-fee terms (v2)", () => {
  assert.equal(SHIPPER_TERMS_VERSION, "v2");
});

test("completing a shipment returns before any Stripe call while fees are off", () => {
  const src = readFileSync("app/admin/shipments/actions.ts", "utf8");
  const guard = src.indexOf("if (!SHIPPER_FEES_ENABLED)");
  const charge = src.indexOf("paymentIntents.create");
  assert.ok(guard > 0, "completeShipment has no fees-off guard");
  assert.ok(charge > guard, "the Stripe charge must come after the fees-off guard");
});

test("shipper signup no longer starts a Stripe card setup", () => {
  const src = readFileSync("app/shipper/signup/actions.ts", "utf8");
  assert.doesNotMatch(src, /getStripe|checkout\.sessions|mode: "setup"/);
});
