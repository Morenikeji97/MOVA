import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EXPORT_PAPERWORK,
  initialEstimateCountry,
  LOWEST_FREIGHT,
  shippingEstimateFor,
  SHIPPING_ESTIMATES,
  US_PICKUP_TO_PORT,
} from "./shipping-estimates.ts";

test("freight ranges and ports match the published 2026 figures", () => {
  assert.deepEqual(
    SHIPPING_ESTIMATES.map((e) => [e.code, e.port, e.freight.min, e.freight.max]),
    [
      ["NG", "Lagos", 1200, 1700],
      ["GH", "Tema", 1150, 1450],
      ["TG", "Lomé", 1200, 1450],
      ["BJ", "Cotonou", 1250, 1455],
    ],
  );
});

test("Togo needs an ECTN and Benin a CTN, $175 each; Nigeria and Ghana need neither", () => {
  assert.deepEqual(shippingEstimateFor("TG").trackingNote, { label: "ECTN", fee: 175 });
  assert.deepEqual(shippingEstimateFor("BJ").trackingNote, { label: "CTN", fee: 175 });
  assert.equal(shippingEstimateFor("NG").trackingNote, null);
  assert.equal(shippingEstimateFor("GH").trackingNote, null);
});

test("pickup and paperwork ranges apply to every destination", () => {
  assert.deepEqual(US_PICKUP_TO_PORT, { min: 300, max: 1500 });
  assert.deepEqual(EXPORT_PAPERWORK, { min: 150, max: 600 });
});

test("the 'from ~$…' figure is the cheapest freight (Ghana, $1,150)", () => {
  assert.equal(LOWEST_FREIGHT, 1150);
});

test("every range is ordered min <= max", () => {
  for (const e of SHIPPING_ESTIMATES) assert.ok(e.freight.min <= e.freight.max, e.code);
  assert.ok(US_PICKUP_TO_PORT.min <= US_PICKUP_TO_PORT.max);
  assert.ok(EXPORT_PAPERWORK.min <= EXPORT_PAPERWORK.max);
});

test("initial country: the buyer's profile beats the browser's last choice", () => {
  assert.equal(initialEstimateCountry("GH", "TG"), "GH");
});

test("initial country: the browser's last choice when there's no usable profile country", () => {
  assert.equal(initialEstimateCountry(null, "BJ"), "BJ");
  assert.equal(initialEstimateCountry("US", "TG"), "TG"); // US isn't an estimate destination
});

test("initial country: nothing usable means no preselection", () => {
  assert.equal(initialEstimateCountry(undefined, "ZZ"), null);
  assert.equal(initialEstimateCountry(null, null), null);
});
