import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Shipper verification gate (migration 0060): certificates are private,
// shippers can't verify themselves, and approval needs both checks.

const sql = readFileSync("supabase/migrations/0060_shipper_verification_gate.sql", "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(e.name) && !e.name.includes(".test.") ? [p] : [];
  });
}

test("only code-checked admin pages open insurance certificates", () => {
  for (const path of [...sourceFiles("app"), ...sourceFiles("lib"), ...sourceFiles("components")]) {
    const text = readFileSync(path, "utf8");
    if (!/SHIPPER_INSURANCE_BUCKET|shipper-insurance-documents/.test(text)) continue;
    if (!/createSignedUrl|\.download\(/.test(text)) continue;
    assert.ok(path.startsWith(join("app", "admin")), `${path} opens certificates outside admin`);
    assert.match(text, /requireAdmin\(/, `${path} opens certificates without requireAdmin()`);
  }
});

test("the certificate bucket is private with no read rule", () => {
  assert.match(sql, /'shipper-insurance-documents', 'shipper-insurance-documents', false/);
  const policies = sql
    .split(/create policy/i)
    .slice(1)
    .map((p) => p.slice(0, p.indexOf(";")))
    .filter((p) => p.includes("shipper-insurance-documents"));
  assert.ok(policies.length > 0);
  for (const p of policies) assert.doesNotMatch(p, /for select/i);
});

test("every new verification column is pinned for the shipper, and nulled on sign-up", () => {
  const added = [...sql.matchAll(/add column if not exists (\w+)/g)].map((m) => m[1]);
  assert.ok(added.length >= 10);
  const guard = sql.slice(sql.indexOf("shippers_guard_owner_editable_fields()"), sql.indexOf("shippers_guard_insert_verification()"));
  const insert = sql.slice(sql.indexOf("shippers_guard_insert_verification()"), sql.indexOf("shippers_require_verification_to_approve()"));
  for (const c of added) {
    assert.match(guard, new RegExp(`new\\.${c} := old\\.${c};`), `owner guard doesn't pin ${c}`);
    assert.match(insert, new RegExp(`new\\.${c} := `), `sign-up guard doesn't reset ${c}`);
  }
});

test("approval needs an in-date certificate and a checked license; public reads use the one rule", () => {
  assert.match(sql, /raise exception 'shipper_coi_required'/);
  assert.match(sql, /raise exception 'shipper_license_required'/);
  assert.match(sql, /"shippers approved public read"[\s\S]*?using \(public\.shipper_is_bookable\(id\)\)/);
  assert.match(sql, /"shipping rates public active read"[\s\S]*?public\.shipper_is_bookable\(shipper_id\)/);
  assert.match(sql, /view public\.shipper_rates_public[\s\S]*?where r\.active and public\.shipper_is_bookable\(s\.id\)/);
});

test("the expiry job calls shipmova.com (not the old redirected address)", () => {
  assert.match(sql, /url := 'https:\/\/shipmova\.com\/api\/cron\/shipper-insurance'/);
});
