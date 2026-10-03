import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LAGOS_PORT_AND_CLEARING,
  nigeriaCustomsCharges,
  nigeriaLandedEstimate,
} from "./landed-cost.ts";

test("customs charges follow the 2026 rates for a 2.0–3.9L car", () => {
  // $10,000 car, $1,500 freight: CIF = 10,000 + 150 insurance + 1,500 = 11,650
  const c = nigeriaCustomsCharges(10_000, 1_500, "2_to_4l");
  assert.equal(c.cif, 11_650);
  assert.equal(c.importDuty, 2_330); // 20% of CIF
  assert.equal(c.nacLevy, 583); // 5% of CIF (582.5)
  assert.equal(c.greenTax, 233); // 2% of CIF
  assert.equal(c.surcharge, 163); // 7% of duty (163.1)
  assert.equal(c.etls, 58); // 0.5% of CIF (58.25)
  assert.equal(c.fobCharge, 400); // 4% of FOB
  // VAT: 7.5% of (11,650 + 3,766.85) = 1,156.26
  assert.equal(c.vat, 1_156);
  assert.equal(c.total, 4_923);
});

test("green tax is 0% under 2.0L and 4% at 4.0L+", () => {
  assert.equal(nigeriaCustomsCharges(10_000, 1_500, "under_2l").greenTax, 0);
  assert.equal(nigeriaCustomsCharges(10_000, 1_500, "4l_plus").greenTax, 466);
});

test("bigger engines and dearer cars cost more in customs", () => {
  const small = nigeriaCustomsCharges(10_000, 1_500, "under_2l").total;
  const big = nigeriaCustomsCharges(10_000, 1_500, "4l_plus").total;
  assert.ok(big > small);
  assert.ok(nigeriaCustomsCharges(20_000, 1_500).total > nigeriaCustomsCharges(10_000, 1_500).total);
});

test("landed range adds ShipMova total, shipping, customs and clearing", () => {
  const e = nigeriaLandedEstimate({
    vehiclePrice: 10_000,
    totalBeforeShipping: 11_040,
    freight: { min: 1_200, max: 1_700 },
    usPickup: { min: 300, max: 1_500 },
    exportPaperwork: { min: 150, max: 600 },
  });
  assert.deepEqual(e.shipping, { min: 1_650, max: 3_800 });
  assert.equal(
    e.landed.min,
    11_040 + 1_650 + nigeriaCustomsCharges(10_000, 1_200).total + LAGOS_PORT_AND_CLEARING.min,
  );
  assert.equal(
    e.landed.max,
    11_040 + 3_800 + nigeriaCustomsCharges(10_000, 1_700).total + LAGOS_PORT_AND_CLEARING.max,
  );
  assert.ok(e.landed.max > e.landed.min);
});
