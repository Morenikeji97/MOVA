import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Founder's conditions for Togo/Benin ID photos (2026-10-05):
//   - private, readable only by an admin with the authenticator code, never
//     by sellers or other buyers;
//   - deleted automatically once approved or rejected, keeping only the
//     decision, its date and who decided (in the audit log).

const ACTIONS = "app/admin/buyer-ids/actions.ts";
const actions = readFileSync(ACTIONS, "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(e.name) && !e.name.includes(".test.") ? [p] : [];
  });
}

test("approve and reject both go through the one decision path", () => {
  assert.match(actions, /export async function approveBuyerId[\s\S]*?return decide\(formData, true\)/);
  assert.match(actions, /export async function rejectBuyerId[\s\S]*?return decide\(formData, false\)/);
});

test("the decision clears the photo path, then deletes the photo, then writes the audit log", () => {
  const decide = actions.slice(actions.indexOf("async function decide("));
  const clearPath = decide.indexOf("id_document_path: null");
  const remove = decide.indexOf(".storage.from(BUYER_ID_BUCKET).remove(");
  const audit = decide.indexOf("logAdminAction(");
  assert.ok(clearPath > 0, "the decision must clear id_document_path");
  assert.ok(remove > clearPath, "the photo must be deleted after the decision is saved");
  assert.ok(audit > remove, "the audit entry is written after the photo is deleted");
  // The decision is checked before anything is deleted.
  assert.match(decide.slice(0, remove), /row\.id_document_path !== null/);
  // The audit log keeps the decision (action), date (created_at) and who
  // (the session) — and whether the photo was deleted, never the photo.
  assert.match(decide, /"buyer_id\.approve" : "buyer_id\.reject"/);
  assert.match(decide, /photo_deleted/);
  // The path itself is never written into the audit details (only whether
  // the photo was deleted).
  const details = decide.slice(audit, decide.indexOf(");", audit));
  assert.doesNotMatch(details, /id_document_path|signedUrl/);
});

test("only code-checked admin code can read ID photos", () => {
  const readers: string[] = [];
  for (const path of [...sourceFiles("app"), ...sourceFiles("lib"), ...sourceFiles("components")]) {
    const text = readFileSync(path, "utf8");
    const touchesBucket = /BUYER_ID_BUCKET|buyer-id-documents/.test(text);
    if (touchesBucket && /createSignedUrl|\.download\(/.test(text)) readers.push(path);
  }
  for (const path of readers) {
    assert.ok(path.startsWith(join("app", "admin")), `${path} reads ID photos outside admin`);
    assert.match(readFileSync(path, "utf8"), /requireAdmin\(/, `${path} reads ID photos without requireAdmin()`);
  }
});

test("the bucket is private with no read rule for anyone (migration 0058)", () => {
  const sql = readFileSync("supabase/migrations/0058_buyer_id_at_signup.sql", "utf8");
  assert.match(sql, /'buyer-id-documents', 'buyer-id-documents', false/);
  const bucketPolicies = sql.split(/create policy/i).slice(1).filter((p) => p.includes("buyer-id-documents"));
  assert.ok(bucketPolicies.length > 0);
  for (const p of bucketPolicies) assert.doesNotMatch(p, /for select/i, "no read policy may exist on the ID bucket");
});
