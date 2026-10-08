import { test } from "node:test";
import assert from "node:assert/strict";
import {
  confirmRedirectLocation,
  destinationAfterConfirm,
  isEmailLinkType,
  safeNextPath,
} from "./auth-redirect.ts";

// ---------------------------------------------------------------------------
// confirmRedirectLocation — the Location /auth/confirm actually sends
// ---------------------------------------------------------------------------

test("a destination without a query gets its own explicit one", () => {
  assert.equal(confirmRedirectLocation("/buyer/dashboard"), "/buyer/dashboard?from=email");
  assert.equal(confirmRedirectLocation("/reset-password"), "/reset-password?from=email");
});

test("a destination's own query is kept as is", () => {
  assert.equal(
    confirmRedirectLocation("/buyer/dashboard?email=changed"),
    "/buyer/dashboard?email=changed",
  );
});

test("never carries the email link's token_hash, type or next", () => {
  for (const dest of [
    "/buyer/dashboard",
    "/reset-password",
    "/seller/dashboard?token_hash=abc&type=magiclink&next=%2Fdashboard",
    "/x?next=/y&keep=1",
  ]) {
    const loc = confirmRedirectLocation(dest);
    assert.doesNotMatch(loc, /token_hash|[?&]type=|[?&]next=/, loc);
    assert.match(loc, /\?./, `has its own query: ${loc}`);
  }
  assert.equal(confirmRedirectLocation("/x?next=/y&keep=1"), "/x?keep=1");
});

test("end to end: every destination the route can produce has its own query", () => {
  for (const type of ["email", "magiclink", "email_change", "recovery", "invite"] as const) {
    for (const role of ["buyer", "seller", "admin", null]) {
      const loc = confirmRedirectLocation(destinationAfterConfirm({ type, next: "/dashboard", role }));
      assert.match(loc, /^\/[^?]*\?[^=]+=/, `${type}/${role}: ${loc}`);
    }
  }
});

test("signup lands on the user's own dashboard by role", () => {
  assert.equal(destinationAfterConfirm({ type: "email", next: "/dashboard", role: "buyer" }), "/buyer/dashboard");
  assert.equal(destinationAfterConfirm({ type: "signup", next: "/dashboard", role: "seller" }), "/seller/dashboard");
  assert.equal(destinationAfterConfirm({ type: "magiclink", next: null, role: "admin" }), "/admin/dashboard");
});

test("a shipper goes to the shipper portal", () => {
  assert.equal(
    destinationAfterConfirm({ type: "email", next: "/dashboard", role: "buyer", isShipper: true }),
    "/shipper/portal",
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
