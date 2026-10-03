import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_NG_RATES,
  describeRateChanges,
  fractionToPercentText,
  nigeriaCustomsCharges,
  nigeriaLandedEstimate,
  parseRatesForm,
  ratesFromRow,
} from "./landed-cost.ts";

const LAGOS_PORT_AND_CLEARING = DEFAULT_NG_RATES.portAndClearing;

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

const SEED_ROW = {
  import_duty_rate: "0.2000",
  nac_levy_rate: "0.0500",
  green_tax_under_2l_rate: "0.0000",
  green_tax_2_to_4l_rate: "0.0200",
  green_tax_4l_plus_rate: "0.0400",
  surcharge_rate_of_duty: "0.0700",
  etls_rate: "0.0050",
  fob_charge_rate: "0.0400",
  vat_rate: "0.0750",
  insurance_rate: "0.0150",
  port_clearing_min_usd: "500.00",
  port_clearing_max_usd: "1000.00",
};

test("the seeded database row reads back as the default rates", () => {
  assert.deepEqual(ratesFromRow(SEED_ROW), DEFAULT_NG_RATES);
});

test("rates from the database change the estimate", () => {
  const higherDuty = { ...ratesFromRow(SEED_ROW), importDuty: 0.35 };
  assert.ok(
    nigeriaCustomsCharges(10_000, 1_500, "2_to_4l", higherDuty).total >
      nigeriaCustomsCharges(10_000, 1_500, "2_to_4l").total,
  );
});

function formOf(overrides: Record<string, string> = {}) {
  const base: Record<string, string> = {};
  for (const [k, v] of Object.entries(SEED_ROW)) {
    base[k] = k.endsWith("_usd") ? String(Number(v)) : fractionToPercentText(v);
  }
  const all = { ...base, ...overrides };
  return (name: string) => all[name];
}

test("the admin form round-trips percents to fractions", () => {
  assert.equal(fractionToPercentText("0.0750"), "7.5");
  assert.equal(fractionToPercentText(0.005), "0.5");
  const parsed = parseRatesForm(formOf({ vat_rate: "7.5%", port_clearing_max_usd: "$1,200" }));
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.equal(parsed.row.vat_rate, 0.075);
  assert.equal(parsed.row.etls_rate, 0.005);
  assert.equal(parsed.row.port_clearing_max_usd, 1200);
});

test("the admin form rejects blanks, over-100 percents and an inverted range", () => {
  assert.equal(parseRatesForm(formOf({ vat_rate: "" })).ok, false);
  assert.equal(parseRatesForm(formOf({ vat_rate: "abc" })).ok, false);
  assert.equal(parseRatesForm(formOf({ import_duty_rate: "120" })).ok, false);
  assert.equal(parseRatesForm(formOf({ import_duty_rate: "-5" })).ok, false);
  assert.equal(
    parseRatesForm(formOf({ port_clearing_min_usd: "900", port_clearing_max_usd: "800" })).ok,
    false,
  );
});

test("the audit note lists only what changed", () => {
  const parsed = parseRatesForm(formOf({ import_duty_rate: "25" }));
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.equal(describeRateChanges(SEED_ROW, parsed.row), "import_duty_rate 0.2 -> 0.25");
  const same = parseRatesForm(formOf());
  assert.ok(same.ok);
  if (!same.ok) return;
  assert.equal(describeRateChanges(SEED_ROW, same.row), "no rate changes; marked as checked");
});
