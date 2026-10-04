import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// shippers, vehicles and fx_rates have no table-level SELECT for the API
// roles (column grants only: 0016, 0037, 0050). A select("*") on them is
// refused, and a refused head/count query just comes back empty — which is
// how the admin dashboard showed "0 shippers pending" while 3 were waiting.

const RESTRICTED = ["shippers", "vehicles", "fx_rates"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(e.name) && !e.name.includes(".test.") ? [p] : [];
  });
}

test('no select("*") on tables that only have column grants', () => {
  const offenders: string[] = [];
  for (const path of [...sourceFiles("app"), ...sourceFiles("lib")]) {
    const lines = readFileSync(path, "utf8").split("\n");
    lines.forEach((line, i) => {
      const m = line.match(/\.from\("([a-z_]+)"\)/);
      if (!m || !RESTRICTED.includes(m[1])) return;
      const next = lines.slice(i, i + 4).join("\n");
      if (/\.select\(\s*"\*"/.test(next)) offenders.push(`${path}:${i + 1} (${m[1]})`);
    });
  }
  assert.deepEqual(offenders, []);
});

test("shipper signup sends the application emails and reports failures", () => {
  const src = readFileSync("app/shipper/signup/actions.ts", "utf8");
  assert.match(src, /notifyShipperApplication\(/);
  assert.match(src, /error: "server"/);
  assert.match(src, /email=failed/);
});
