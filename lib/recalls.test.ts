import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseRecalls, recallsUrl } from "./recalls.ts";
import { fetchTitleHistory, isVinAuditConfigured } from "./vinaudit.ts";

test("NHTSA recalls: parsed, de-duplicated by campaign, park-it flag kept", () => {
  const r = parseRecalls({
    Count: 3,
    results: [
      { NHTSACampaignNumber: "15V144000", Component: "STEERING", Summary: "s", parkIt: false },
      { NHTSACampaignNumber: "15V144000", Component: "STEERING", Summary: "s", parkIt: false },
      { NHTSACampaignNumber: "19V001000", Component: "AIR BAGS", Summary: "a", parkIt: true },
    ],
  });
  assert.ok(r.ok);
  assert.deepEqual(
    r.recalls.map((x) => [x.campaign, x.parkIt]),
    [
      ["15V144000", false],
      ["19V001000", true],
    ],
  );
});

test("an unexpected NHTSA response is a failed lookup, never 'no recalls'", () => {
  assert.deepEqual(parseRecalls(null), { ok: false });
  assert.deepEqual(parseRecalls({ Message: "error" }), { ok: false });
  assert.deepEqual(parseRecalls({ Count: 0, results: [] }), { ok: true, recalls: [] });
});

test("the recall URL encodes make, model and year", () => {
  assert.equal(
    recallsUrl("LAND ROVER", "Range Rover Sport", 2016),
    "https://api.nhtsa.gov/recalls/recallsByVehicle?make=LAND+ROVER&model=Range+Rover+Sport&modelYear=2016",
  );
});

test("VinAudit is a stub until the key exists, and never claims a clean history", async () => {
  const before = process.env.VINAUDIT_API_KEY;
  delete process.env.VINAUDIT_API_KEY;
  assert.equal(isVinAuditConfigured(), false);
  assert.deepEqual(await fetchTitleHistory("1HGCM82633A004352"), { status: "not_configured" });
  if (before !== undefined) process.env.VINAUDIT_API_KEY = before;
});

test("a 400 from NHTSA means 'make/model not recognised', never 'no recalls'", () => {
  const src = readFileSync("lib/recalls.ts", "utf8");
  assert.match(src, /res\.status === 400\) return \{ ok: false, unrecognised: true \}/);
});
