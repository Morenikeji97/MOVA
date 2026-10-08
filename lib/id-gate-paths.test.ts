import { test } from "node:test";
import assert from "node:assert/strict";
import { isIdExempt } from "./id-gate-paths.ts";

test("an unverified buyer can reach the ID step, sign-in, legal pages and the waitlist", () => {
  for (const p of ["/buyer/verify-id", "/login", "/signup", "/auth/confirm", "/terms", "/terms/accept", "/policies/buyer-protection", "/waitlist", "/reset-password"]) {
    assert.equal(isIdExempt(p), true, p);
  }
});

test("everything a member uses is gated, including look-alike prefixes", () => {
  for (const p of ["/", "/browse", "/browse/abc", "/buyer/dashboard", "/chat", "/referrals", "/buyer/verify-idx", "/waitlisted"]) {
    assert.equal(isIdExempt(p), false, p);
  }
});

test("shippers (who sign in with buyer-role accounts) reach the shipper pages", () => {
  for (const p of ["/shipper", "/shipper/signup", "/shipper/portal", "/shipper/dashboard", "/shipper/profile"]) {
    assert.equal(isIdExempt(p), true, p);
  }
  assert.equal(isIdExempt("/shippers-guide"), false);
});
