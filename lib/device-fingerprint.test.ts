import { test } from "node:test";
import assert from "node:assert/strict";
import { hashFingerprint } from "./device-fingerprint.ts";

test("hashFingerprint is deterministic for the same input", () => {
  assert.equal(hashFingerprint("a|b|c"), hashFingerprint("a|b|c"));
});

test("hashFingerprint differs for different input", () => {
  assert.notEqual(hashFingerprint("a|b|c"), hashFingerprint("a|b|d"));
});
