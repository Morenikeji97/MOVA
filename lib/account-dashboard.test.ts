import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { accountDashboard } from "./account-dashboard.ts";
import { VERIFY_ID_PATH } from "./id-gate-paths.ts";

// Founder, 2026-10-08: signed in, the header shows "My dashboard" going to
// the right place by role, and "Sign out" in the phone menu and the desktop
// Account menu.

test("each role's My dashboard goes to its own home", () => {
  const go = (role: string | null, kind: "shipper" | null = null, buyerVerified = false) =>
    accountDashboard({ role, kind, buyerVerified }).primary.href;
  assert.equal(go("buyer", null, true), "/buyer/dashboard");
  assert.equal(go("seller"), "/seller/listings");
  assert.equal(go("admin"), "/admin/dashboard");
  assert.equal(go("buyer", "shipper"), "/shipper/portal");
});

test("an unverified buyer is pointed at Verify your ID", () => {
  const d = accountDashboard({ role: "buyer", kind: null, buyerVerified: false });
  assert.deepEqual(d.primary, { label: "Verify your ID", href: VERIFY_ID_PATH });
});

test("a seller who is also a shipper keeps My listings", () => {
  const d = accountDashboard({ role: "seller", kind: "shipper", buyerVerified: false });
  assert.equal(d.primary.href, "/shipper/portal");
  assert.deepEqual(d.extras, [{ label: "My listings", href: "/seller/listings" }]);
});

test("the header offers Sign In, Create account and Sign out", () => {
  const src = readFileSync(new URL("../components/ui/header-controls.tsx", import.meta.url), "utf8");
  assert.ok(src.includes('href="/signup"'), "Create account links to sign-up, not only the waitlist");
  assert.ok(src.includes('href="/login"'));
  assert.equal(src.match(/: "Sign out"}/g)?.length, 2, "Sign out in the desktop menu and the phone menu");
});
