import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_LANDED_COST_RATES, landedEstimate, parseLandedForm } from "./landed-cost.ts";

// Founder, 2026-10-09: total delivered cost to Lagos / Tema / Lomé / Cotonou,
// every figure sourced, dated and "confirm with your clearing agent".

const base = {
  vehiclePrice: 10_000,
  totalBeforeShipping: 10_850,
  freight: { min: 1200, max: 1700 },
  usPickup: { min: 300, max: 1500 },
  exportPaperwork: { min: 150, max: 600 },
};

test("Lagos: CIF, duties as % of CIF, port & clearing, total", () => {
  const e = landedEstimate({ ...base, rates: DEFAULT_LANDED_COST_RATES.NG });
  // CIF = 10,000 + 1.5% insurance + freight.
  assert.deepEqual(e.cif, { min: 11_350, max: 11_850 });
  assert.deepEqual(e.duties, { min: 4540, max: 5333 }); // 40% of 11,350; 45% of 11,850
  assert.deepEqual(e.shipping, { min: 1650, max: 3800 });
  assert.deepEqual(e.portClearing, { min: 500, max: 1000 });
  assert.deepEqual(e.landed, { min: 10_850 + 1650 + 4540 + 500, max: 10_850 + 3800 + 5333 + 1000 });
});

test("Tema: port & clearing not included when there's no source", () => {
  const e = landedEstimate({ ...base, rates: DEFAULT_LANDED_COST_RATES.GH });
  assert.equal(e.portClearing, null);
  assert.equal(e.landed.min, 10_850 + 1650 + Math.round(11_350 * 0.31));
});

test("Cotonou: fixed fees and the CTN fee are counted", () => {
  const e = landedEstimate({ ...base, trackingFee: 175, rates: DEFAULT_LANDED_COST_RATES.BJ });
  assert.equal(e.fixedFees, 175);
  assert.equal(e.shipping.min, 1650 + 175);
});

test("every country has a source and a last-checked date", () => {
  for (const [c, r] of Object.entries(DEFAULT_LANDED_COST_RATES)) {
    assert.ok(r.sourceNote.length > 0, c);
    assert.match(r.lastCheckedOn, /^\d{4}-\d{2}-\d{2}$/, c);
    assert.ok(r.dutiesPct.max >= r.dutiesPct.min, c);
  }
});

test("the built-in figures match the migration's seed rows", () => {
  const sql = readFileSync("supabase/migrations/0068_landed_cost_rates.sql", "utf8");
  for (const [c, r] of Object.entries(DEFAULT_LANDED_COST_RATES)) {
    const pc = r.portClearing ? `${r.portClearing.min}, ${r.portClearing.max}` : "null, null";
    const row = `('${c}', ${r.dutiesPct.min}, ${r.dutiesPct.max}, ${r.insurancePct}, ${r.fixedFeesUsd}, ${pc},`;
    assert.ok(sql.includes(row), `${c}: ${row}`);
  }
});

test("admin form: validates percents, port & clearing pairs, source", () => {
  const form = (o: Record<string, string>) => (n: string) =>
    ({
      duties_min_pct: "40",
      duties_max_pct: "45",
      insurance_pct: "1.5",
      fixed_fees_usd: "0",
      port_clearing_min_usd: "500",
      port_clearing_max_usd: "1000",
      source_note: "Agent X, 2026-10-10",
      source_url: "",
      ...o,
    })[n];
  const ok = parseLandedForm(form({}));
  assert.ok(ok.ok);
  if (ok.ok) assert.equal(ok.row.source_url, null);
  const blankPc = parseLandedForm(form({ port_clearing_min_usd: "", port_clearing_max_usd: "" }));
  assert.ok(blankPc.ok && blankPc.row.port_clearing_min_usd === null);
  assert.equal(parseLandedForm(form({ port_clearing_max_usd: "" })).ok, false);
  assert.equal(parseLandedForm(form({ duties_max_pct: "30" })).ok, false);
  assert.equal(parseLandedForm(form({ source_note: " " })).ok, false);
  assert.equal(parseLandedForm(form({ source_url: "http://x" })).ok, false);
  assert.equal(parseLandedForm(form({ duties_min_pct: "abc" })).ok, false);
});

test("the admin save is admin-only and audit-logged", () => {
  const src = readFileSync("app/admin/landed-cost/actions.ts", "utf8");
  assert.match(src, /await requireAdmin\(\)/);
  assert.match(src, /logAdminAction\(/);
  assert.match(src, /checkWrite\(result\)/);
});

test("no delivered cost is shown for a car that can't be imported there", () => {
  const src = readFileSync("components/ui/shipping-estimate.tsx", "utf8");
  assert.match(src, /\["too_old", "not_allowed"\]\.includes\(importStatus\(estimate\.code, modelYear\)\.kind\)/);
});
