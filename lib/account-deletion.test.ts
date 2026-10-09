import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { anonymizeErrorMessage, confirmedDelete, isProtectedAccount, OPEN_DEALS_MESSAGE } from "./account-deletion.ts";
import { isIdExempt } from "./id-gate-paths.ts";

// Privacy Policy §9 promises account deletion "subject to ShipMova's
// retention obligations under Section 8". Founder, 2026-10-09: add it.

const sql = readFileSync("supabase/migrations/0069_account_deletion.sql", "utf8");
const adminAction = readFileSync("app/admin/account-deletions/actions.ts", "utf8");
const userAction = readFileSync("app/account/actions.ts", "utf8");

test("confirmation word", () => {
  assert.equal(confirmedDelete("DELETE"), true);
  assert.equal(confirmedDelete(" delete "), true);
  assert.equal(confirmedDelete("delet"), false);
  assert.equal(confirmedDelete(null), false);
});

test("only the server can anonymise, and only with no deal in progress", () => {
  assert.match(sql, /revoke execute on function public\.anonymize_account\(uuid\) from public, anon, authenticated;/);
  assert.match(sql, /grant execute on function public\.anonymize_account\(uuid\) to service_role;/);
  assert.match(sql, /raise exception 'account_has_open_deals'/);
  assert.equal(anonymizeErrorMessage("ERROR: account_has_open_deals"), OPEN_DEALS_MESSAGE.replace("Your account has", "This account has"));
});

test("anonymising keeps deal and policy records (no hard delete) and clears personal details", () => {
  assert.doesNotMatch(sql, /delete from public\.(users|purchase_requests|policy_acceptances|terms_acceptances|privacy_policy_acceptances)\b/);
  for (const col of ["phone = null", "whatsapp_number = null", "signup_ip = null", "full_name = null", "buyer_email = null"]) {
    assert.ok(sql.includes(col), col);
  }
  assert.match(sql, /set status = 'archived'/);
  assert.match(sql, /'deleted\+' \|\| p_user::text \|\| '@deleted\.shipmova\.invalid'/);
});

test("a person may only ask for their own account", () => {
  assert.match(sql, /for insert with check \(\s*user_id = \(select auth\.uid\(\)\) and status = 'pending'/);
  assert.match(sql, /where status = 'pending'/); // one pending request per person
});

test("the request re-checks the password without signing the person out elsewhere", () => {
  assert.match(userAction, /signInWithPassword\(\{ email: user\.email, password \}\)/);
  assert.match(userAction, /signOut\(\{ scope: "local" \}\)/);
  assert.match(userAction, /confirmedDelete\(/);
});

test("the admin action: code first, soft delete, confirmation to the original address", () => {
  assert.ok(adminAction.indexOf("await requireAdmin()") < adminAction.indexOf("createAdminClient()"));
  assert.match(adminAction, /auth\.admin\.deleteUser\(req\.user_id, true\)/); // soft delete: no cascade
  assert.ok(adminAction.indexOf("const originalEmail = person.email") < adminAction.indexOf('rpc("anonymize_account"'));
  assert.match(adminAction, /notifyAccountDeleted\(originalEmail\)/);
  assert.match(adminAction, /logAdminAction\(/);
  assert.equal(isProtectedAccount("admin"), true);
  assert.equal(isProtectedAccount("buyer"), false);
});

test("deleting your account is never blocked by the ID or terms gates", () => {
  assert.equal(isIdExempt("/account"), true);
  assert.match(readFileSync("middleware.ts", "utf8"), /"\/account", \/\/ deleting your account/);
});
