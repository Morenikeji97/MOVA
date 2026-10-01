import { test } from "node:test";
import assert from "node:assert/strict";
import { isMfaExempt } from "./admin-mfa-paths.ts";

test("the code page, sign-in and emailed-link routes are reachable without a code", () => {
  for (const path of ["/mfa", "/login", "/auth/confirm", "/auth/link-expired", "/auth"]) {
    assert.equal(isMfaExempt(path), true, path);
  }
});

test("everything else needs the code, including look-alike prefixes", () => {
  for (const path of [
    "/",
    "/admin/dashboard",
    "/admin/security",
    "/reset-password",
    "/mfa-settings",
    "/loginx",
    "/authority",
    "/browse",
  ]) {
    assert.equal(isMfaExempt(path), false, path);
  }
});
