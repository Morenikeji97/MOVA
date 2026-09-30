import { test } from "node:test";
import assert from "node:assert/strict";
import { destinationAfterConfirm, isEmailLinkType, safeNextPath } from "./auth-redirect.ts";

test("signup lands on the user's own dashboard by role", () => {
  assert.equal(destinationAfterConfirm({ type: "email", next: "/dashboard", role: "buyer" }), "/buyer/dashboard");
  assert.equal(destinationAfterConfirm({ type: "signup", next: "/dashboard", role: "seller" }), "/seller/dashboard");
  assert.equal(destinationAfterConfirm({ type: "magiclink", next: null, role: "admin" }), "/admin/dashboard");
});

test("a shipper goes to the shipper dashboard", () => {
  assert.equal(
    destinationAfterConfirm({ type: "email", next: "/dashboard", role: "buyer", isShipper: true }),
    "/shipper/dashboard",
  );
});

test("recovery and invite always go to set a password", () => {
  assert.equal(destinationAfterConfirm({ type: "recovery", next: "/admin/dashboard", role: "buyer" }), "/reset-password");
  assert.equal(destinationAfterConfirm({ type: "invite", next: null, role: null }), "/reset-password");
});

test("a real same-site next path is honoured", () => {
  assert.equal(destinationAfterConfirm({ type: "email_change", next: "/buyer/dashboard?email=changed", role: "buyer" }), "/buyer/dashboard?email=changed");
});

test("unknown role with no next goes home", () => {
  assert.equal(destinationAfterConfirm({ type: "email", next: null, role: null }), "/");
});

test("open-redirect attempts are ignored", () => {
  for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "evil.com", "/ok\u0000", ""]) {
    assert.equal(safeNextPath(bad), null, JSON.stringify(bad));
  }
  assert.equal(
    destinationAfterConfirm({ type: "email", next: "//evil.com/steal", role: "buyer" }),
    "/buyer/dashboard",
  );
});

test("only Supabase's email link types are accepted", () => {
  for (const t of ["signup", "email", "magiclink", "recovery", "invite", "email_change"]) {
    assert.ok(isEmailLinkType(t), t);
  }
  assert.ok(!isEmailLinkType("sms"));
  assert.ok(!isEmailLinkType("anything"));
});
