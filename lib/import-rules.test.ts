import { test } from "node:test";
import assert from "node:assert/strict";
import {
  importStatus,
  modelYearFrom,
  nigeriaCutoffYear,
  nigeriaImportStatus,
  NOT_CHECKED_LABEL,
  vinYearCode,
  ghanaImportStatus,
  importStatusAll,
} from "./import-rules.ts";

// ---------------------------------------------------------------------------
// Nigeria 12-year rule (as of 2026: model year 2014 or newer)
// ---------------------------------------------------------------------------

test("Nigeria cutoff in 2026 is model year 2014", () => {
  assert.equal(nigeriaCutoffYear(2026), 2014);
});

test("newer than the cutoff is importable", () => {
  const s = nigeriaImportStatus(2015, 2026);
  assert.equal(s.kind, "importable");
  assert.equal(s.label, "Importable to Nigeria ✓");
});

test("exactly the cutoff year is borderline, not a checkmark", () => {
  const s = nigeriaImportStatus(2014, 2026);
  assert.equal(s.kind, "borderline");
  assert.equal(
    s.label,
    "Borderline — Nigeria goes by manufacture date. Check the date on the driver's door label",
  );
  assert.doesNotMatch(s.label, /✓/);
});

test("older than the cutoff is too old, naming the cutoff", () => {
  const s = nigeriaImportStatus(2012, 2026);
  assert.equal(s.kind, "too_old");
  assert.equal(s.label, "Too old to import to Nigeria (2014+ only)");
});

test("the cutoff moves with the year", () => {
  assert.equal(nigeriaImportStatus(2014, 2027).kind, "too_old");
  assert.equal(nigeriaImportStatus(2015, 2027).kind, "borderline");
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

test("end to end: a 2012 Land Rover is too old for Nigeria in 2026", () => {
  const year = modelYearFrom(vinYearCode("SALAG2D47CA628413"), 2012, 2026);
  assert.equal(nigeriaImportStatus(year, 2026).kind, "too_old");
});
