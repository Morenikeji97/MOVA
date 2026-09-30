import { test } from "node:test";
import assert from "node:assert/strict";
import { redirectToPath } from "./relative-redirect.ts";

test("redirect Location is the bare path, never an absolute (netlify.app) URL", () => {
  const r = redirectToPath("/buyer/dashboard");
  assert.equal(r.status, 307);
  assert.equal(r.headers.get("location"), "/buyer/dashboard");
});

test("query strings are kept", () => {
  assert.equal(
    redirectToPath("/auth/link-expired?reason=expired&type=email").headers.get("location"),
    "/auth/link-expired?reason=expired&type=email",
  );
});

test("refuses anything that isn't a same-site path", () => {
  for (const bad of ["https://evil.com", "//evil.com", "buyer/dashboard"]) {
    assert.throws(() => redirectToPath(bad), bad);
  }
});
