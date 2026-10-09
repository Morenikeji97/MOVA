import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Migration 0063: inspectors can't approve themselves or write inspections
// directly; photos are private; buyers/sellers see only the badge text.
const sql = readFileSync("supabase/migrations/0063_inspectors.sql", "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(e.name) && !e.name.includes(".test.") ? [p] : [];
  });
}

test("an application is forced to pending and unreviewed", () => {
  const g = sql.slice(sql.indexOf("function public.inspectors_guard_insert()"), sql.indexOf("$$;", sql.indexOf("function public.inspectors_guard_insert()")));
  for (const line of ["new.status := 'pending';", "new.reviewed_by := null;", "new.reviewed_at := null;", "new.is_test := false;"]) {
    assert.ok(g.includes(line), line);
  }
});

test("only admins update inspectors/inspections; nobody inserts inspections or photos through the API", () => {
  assert.match(sql, /"inspectors admin update"[\s\S]*?using \(public\.is_admin\(\)\) with check \(public\.is_admin\(\)\)/);
  assert.match(sql, /"inspections admin update"[\s\S]*?using \(public\.is_admin\(\)\) with check \(public\.is_admin\(\)\)/);
  const policies = sql.split(/create policy/i).slice(1).map((p) => p.slice(0, p.indexOf(";")));
  for (const p of policies) {
    if (/on public\.(inspections|inspection_photos)\b/.test(p)) {
      assert.doesNotMatch(p, /for (insert|delete|all)/i, `unexpected write policy: ${p.slice(0, 80)}`);
    }
  }
});

test("photos: private bucket, no read rule; only admin pages open them", () => {
  assert.match(sql, /'inspection-photos', 'inspection-photos', false/);
  const bucket = sql.split(/create policy/i).slice(1).map((p) => p.slice(0, p.indexOf(";"))).filter((p) => p.includes("inspection-photos"));
  assert.ok(bucket.length > 0);
  for (const p of bucket) assert.doesNotMatch(p, /for select/i);
  for (const path of [...sourceFiles("app"), ...sourceFiles("lib"), ...sourceFiles("components")]) {
    const text = readFileSync(path, "utf8");
    if (!text.includes("inspection-photos") || !/createSignedUrl|\.download\(/.test(text)) continue;
    assert.ok(path.startsWith(join("app", "admin")), `${path} opens inspection photos outside admin`);
    assert.match(text, /requireAdmin\(/, `${path} without requireAdmin()`);
  }
});

test("buyers and sellers get only the badge text, never the inspector or the pay", () => {
  const f = sql.slice(sql.indexOf("function public.inspection_summary"), sql.indexOf("$$;", sql.indexOf("function public.inspection_summary")));
  assert.match(f, /returns text/);
  assert.match(f, /pr\.buyer_id = auth\.uid\(\) or v\.seller_id = auth\.uid\(\) or public\.is_admin\(\)/);
  assert.doesNotMatch(f, /pay_usd|full_name|phone/);
  assert.match(f, /'Inspected at pickup ✓/);
});
