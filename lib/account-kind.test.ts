import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { landingAfterSignIn, serviceAccountKind, serviceAccountRedirect } from "./account-kind.ts";
import { isIdExempt } from "./id-gate-paths.ts";

// Founder, 2026-10-07: any login linked to a shipper application/company is
// a shipper — never sent to Verify your ID, lands on /shipper/portal after
// sign-in, can browse public pages, can't reserve or chat as a buyer.

test("only what the database calls a shipper counts", () => {
  assert.equal(serviceAccountKind("shipper"), "shipper");
  assert.equal(serviceAccountKind("inspector"), "inspector");
  for (const v of [null, undefined, "", "buyer", "SHIPPER", { kind: "shipper" }]) {
    assert.equal(serviceAccountKind(v), null, String(v));
  }
});

test("a shipper opening the buyer area or Verify your ID goes to the shipper portal", () => {
  for (const p of ["/buyer", "/buyer/dashboard", "/buyer/verify-id"]) {
    assert.equal(serviceAccountRedirect("shipper", p), "/shipper/portal", p);
  }
});

test("an inspector lands on /inspector and is kept out of the buyer area too", () => {
  assert.equal(landingAfterSignIn("inspector", null), "/inspector");
  assert.equal(landingAfterSignIn("inspector", "/"), "/inspector");
  assert.equal(serviceAccountRedirect("inspector", "/buyer/verify-id"), "/inspector");
  assert.equal(serviceAccountRedirect("inspector", "/browse"), null);
  assert.equal(serviceAccountRedirect("inspector", "/inspector/abc"), null);
  assert.equal(isIdExempt("/inspector"), true);
});

test("a shipper can browse public pages and use the shipper pages", () => {
  for (const p of ["/", "/browse", "/browse/abc", "/how-it-works", "/terms", "/shipper/portal", "/shipper/dashboard", "/buyers-guide"]) {
    assert.equal(serviceAccountRedirect("shipper", p), null, p);
  }
});

test("plain buyers and sellers are never redirected by this rule", () => {
  for (const p of ["/buyer/dashboard", "/buyer/verify-id", "/"]) {
    assert.equal(serviceAccountRedirect(null, p), null, p);
  }
});

test("after sign-in a shipper lands on the shipper portal", () => {
  assert.equal(landingAfterSignIn("shipper", null), "/shipper/portal");
  assert.equal(landingAfterSignIn("shipper", "/"), "/shipper/portal");
  assert.equal(landingAfterSignIn("shipper", "/buyer/dashboard"), "/shipper/portal");
  assert.equal(landingAfterSignIn("shipper", "/buyer/verify-id?next=/browse"), "/shipper/portal");
});

test("a shipper heading to a specific useful page keeps it", () => {
  assert.equal(landingAfterSignIn("shipper", "/shipper/dashboard"), "/shipper/dashboard");
  assert.equal(landingAfterSignIn("shipper", "/browse/abc"), "/browse/abc");
});

test("everyone else keeps next, or the home page", () => {
  assert.equal(landingAfterSignIn(null, null), "/");
  assert.equal(landingAfterSignIn(null, "/browse/abc"), "/browse/abc");
});

test("a shipper login skips the ID gate in middleware and lands via /auth/landing", () => {
  const session = readFileSync("lib/supabase/middleware.ts", "utf8");
  assert.match(session, /rpc\("my_service_account_kind"\)/);
  assert.match(session, /role === "buyer" && !accountKind/, "the ID gate must not apply to a shipper");
  const mw = readFileSync("middleware.ts", "utf8");
  assert.match(mw, /serviceAccountRedirect\(accountKind, path\)/);
  const login = readFileSync("app/login/page.tsx", "utf8");
  assert.match(login, /\/auth\/landing/);
  assert.equal(isIdExempt("/auth/landing"), true, "the landing route must not be ID-gated");
  const landing = readFileSync("app/auth/landing/route.ts", "utf8");
  assert.match(landing, /safeNextPath\(/, "next must be checked for off-site redirects");
  assert.match(landing, /landingAfterSignIn\(/);
});

test("reserving and buyer chat refuse a shipper in the app, before the ID check", () => {
  const src = readFileSync("lib/buyer-verified.ts", "utf8");
  const kindCheck = src.indexOf("if (accountKind) return SERVICE_ACCOUNT_NOT_BUYER");
  assert.ok(kindCheck > 0);
  assert.ok(kindCheck < src.indexOf('if (account?.role !== "buyer") return null'), "a seller-role shipper is refused too");
});

test("the database refuses a shipper or inspector as the buyer, whatever the browser sends", () => {
  const sql = readFileSync("supabase/migrations/0065_service_accounts_not_buyers.sql", "utf8");
  for (const t of ["purchase_requests", "conversations"]) {
    assert.match(sql, new RegExp(`before insert on public\\.${t}\\s+for each row execute function public\\.${t}_refuse_service_accounts\\(\\)`), t);
  }
  // Not tied to the pre-launch ID switch.
  assert.doesNotMatch(sql, /is_buyer_id_check_required/);
  // Linked shipper, linked inspector, or an approved unclaimed shipper with
  // this login's confirmed email (what the portal offers to claim).
  assert.match(sql, /s\.user_id = p_user\) then 'shipper'/);
  assert.match(sql, /i\.user_id = p_user\) then 'inspector'/);
  assert.match(sql, /s\.user_id is null\s+and s\.status = 'approved'\s+and u\.email_confirmed_at is not null\s+and lower\(s\.contact_email\) = lower\(u\.email\)/);
  // Nobody can ask about another user; the caller only learns about themself.
  assert.match(sql, /revoke execute on function public\.service_account_kind_for\(uuid\) from public, anon, authenticated;/);
  assert.match(sql, /select public\.service_account_kind_for\(auth\.uid\(\)\)/);
  assert.match(sql, /revoke execute on function public\.my_service_account_kind\(\) from public, anon;/);
});
