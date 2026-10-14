import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  importStatus,
  modelYearFrom,
  nigeriaImportStatus,
  NIGERIA_VEHCAP_MODEL_YEAR,
  NOT_CHECKED_LABEL,
  vinYearCode,
  ghanaImportStatus,
  importStatusAll,
} from "./import-rules.ts";

// ---------------------------------------------------------------------------
// Nigeria: no age limit (confirmed with the Lagos clearing-agent partner,
// 2026-10-14) — only a VehCAP note for 2026-model cars.
// ---------------------------------------------------------------------------

test("no age limit: an old car is importable, with no warning", () => {
  const s = nigeriaImportStatus(1990, 2026);
  assert.equal(s.kind, "importable");
  assert.equal(s.label, "Importable to Nigeria ✓");
  assert.equal(s.notes, undefined);
});

test("a brand-new car is importable too", () => {
  assert.equal(nigeriaImportStatus(2025, 2026).kind, "importable");
});

test("a 2026-model car gets the VehCAP note; other years don't", () => {
  const s = nigeriaImportStatus(NIGERIA_VEHCAP_MODEL_YEAR, 2026);
  assert.equal(s.kind, "importable");
  assert.equal(s.notes?.length, 1);
  assert.match(s.notes![0], /VehCAP/);
  assert.match(s.notes![0], /₦500,000\+/);
  assert.equal(nigeriaImportStatus(2025, 2026).notes, undefined);
});

test("Togo and Benin are 'not yet confirmed', never guessed", () => {
  for (const c of ["TG", "BJ"] as const) {
    const s = importStatus(c, 2005, 2026);
    assert.equal(s.kind, "not_checked");
    assert.equal(s.label, NOT_CHECKED_LABEL);
  }
});

// Ghana Standards Authority, from 1 October 2026: over 15 years barred;
// flood / salvage barred at any age; Certificate of Conformity required;
// over 10 years pays a Customs over-age penalty.
test("Ghana: 15-year cutoff, borderline at the cutoff year", () => {
  assert.equal(ghanaImportStatus(2010, {}, 2026).kind, "too_old");
  assert.equal(ghanaImportStatus(2011, {}, 2026).kind, "borderline");
  assert.equal(ghanaImportStatus(2012, {}, 2026).kind, "importable");
  assert.equal(ghanaImportStatus(null, {}, 2026).kind, "unknown_year");
});

test("Ghana: flood and salvage titles are refused at any age", () => {
  assert.equal(ghanaImportStatus(2024, { titleStatus: "Flood" }, 2026).kind, "not_allowed");
  assert.equal(ghanaImportStatus(2024, { titleStatus: "Salvage" }, 2026).kind, "not_allowed");
  assert.equal(ghanaImportStatus(2024, { titleStatus: "Rebuilt" }, 2026).kind, "borderline");
  assert.equal(ghanaImportStatus(2024, { accidentHistory: "Severe damage" }, 2026).kind, "borderline");
  assert.equal(ghanaImportStatus(2024, { titleStatus: "Clean" }, 2026).kind, "importable");
});

test("Ghana: every importable car needs the certificate; over 10 years adds the penalty", () => {
  const young = ghanaImportStatus(2020, {}, 2026);
  assert.equal(young.notes?.length, 1);
  assert.match(young.notes![0], /Certificate of Conformity/);
  const older = ghanaImportStatus(2014, {}, 2026);
  assert.ok(older.notes?.some((n) => /over-age penalty/.test(n)));
});

test("all four countries, Nigeria first", () => {
  assert.deepEqual(
    importStatusAll(2020, {}, 2026).map((s) => s.country),
    ["NG", "GH", "TG", "BJ"],
  );
});

test("unknown model year isn't reported as importable", () => {
  assert.equal(nigeriaImportStatus(null, 2026).kind, "unknown_year");
});

// ---------------------------------------------------------------------------
// Model year from VIN position 10
// ---------------------------------------------------------------------------

test("VIN 10th character: SALAG2D47CA628413 -> C -> 2012", () => {
  assert.equal(vinYearCode("SALAG2D47CA628413"), "C");
  assert.equal(modelYearFrom("C", 2012, 2026), 2012);
});

test("the listing year picks between the two 30-year candidates", () => {
  assert.equal(modelYearFrom("E", 2014, 2026), 2014);
  assert.equal(modelYearFrom("E", 1985, 2026), 1984);
});

test("the VIN wins when it disagrees with the listing year", () => {
  assert.equal(modelYearFrom("E", 2016, 2026), 2014); // E is 1984 or 2014, not 2016
});

test("without a listing year, the latest candidate not in the future", () => {
  assert.equal(modelYearFrom("E", null, 2026), 2014);
  assert.equal(modelYearFrom("1", null, 2026), 2001); // 2031 is in the future
  assert.equal(modelYearFrom("T", null, 2026), 2026);
});

test("invalid or missing code falls back to the listing year", () => {
  assert.equal(modelYearFrom("0", 2015, 2026), 2015);
  assert.equal(modelYearFrom("I", 2015, 2026), 2015);
  assert.equal(modelYearFrom(null, 2015, 2026), 2015);
  assert.equal(vinYearCode("ABC"), null);
});

test("end to end: a 2012 Land Rover is still importable to Nigeria — no age limit", () => {
  const year = modelYearFrom(vinYearCode("SALAG2D47CA628413"), 2012, 2026);
  assert.equal(nigeriaImportStatus(year, 2026).kind, "importable");
});

// Founder, 2026-10-09: every country line shows its source, when ShipMova
// last checked it, and "confirm with your clearing agent".
test("every country's rule has a source and a last-checked date", async () => {
  const { IMPORT_RULE_SOURCES, formatCheckedDate } = await import("./import-rules.ts");
  for (const c of ["NG", "GH", "TG", "BJ"] as const) {
    const src = IMPORT_RULE_SOURCES[c];
    assert.ok(src.short.length > 0, c);
    assert.ok(src.detail.length > 0, c);
    assert.match(src.lastChecked, /^\d{4}-\d{2}-\d{2}$/, c);
  }
  assert.match(IMPORT_RULE_SOURCES.GH.short, /in force 1 Oct 2026/);
  assert.equal(formatCheckedDate("2026-10-09"), "9 Oct 2026");
});

test("each country line says to confirm with a clearing agent", () => {
  const src = readFileSync("components/listing-checks.tsx", "utf8");
  assert.match(src, /<SourceLine country=\{s\.country\} \/>/);
  assert.match(src, /confirm with your clearing agent/);
});
