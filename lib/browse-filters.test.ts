import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORY_CHIPS,
  keywordOrFilter,
  keywordTerms,
  parseBodyFilter,
  parseFuelFilter,
} from "./browse-filters.ts";

test("only chips our data can filter: no Luxury, SUV and Truck together", () => {
  assert.deepEqual(
    CATEGORY_CHIPS.map((c) => c.label),
    ["Sedan", "SUV & Truck", "Hybrid", "Electric"],
  );
  assert.deepEqual(
    CATEGORY_CHIPS.map((c) => c.href),
    ["/browse?type=sedan", "/browse?type=suv_truck", "/browse?fuel=hybrid", "/browse?fuel=electric"],
  );
});

test("unknown category values are ignored", () => {
  assert.equal(parseBodyFilter("sedan"), "sedan");
  assert.equal(parseFuelFilter("electric"), "electric");
  for (const v of ["luxury", "", undefined, "toString", "__proto__", ["sedan"]]) {
    assert.equal(parseBodyFilter(v), null, String(v));
    assert.equal(parseFuelFilter(v), null, String(v));
  }
});

test("keywords are split into safe words", () => {
  assert.deepEqual(keywordTerms("  Toyota   Camry "), ["Toyota", "Camry"]);
  assert.deepEqual(keywordTerms("F-150"), ["F-150"]);
  assert.deepEqual(keywordTerms("a b c d e f"), ["a", "b", "c", "d"]);
  assert.deepEqual(keywordTerms(undefined), []);
});

test("nothing typed can change the filter's structure", () => {
  for (const evil of ["x,status.eq.draft", "x)or(", "%_*", "a.ilike.*", '"quoted"', "camry;drop"]) {
    for (const t of keywordTerms(evil)) {
      assert.match(t, /^[\p{L}\p{N}-]+$/u, `${evil} → ${t}`);
      assert.equal(keywordOrFilter(t).split(",").length, 3, evil);
    }
  }
});
