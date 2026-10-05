import { test } from "node:test";
import assert from "node:assert/strict";
import { checkWrite, notSaved, saved, savedWithAudit } from "./action-result.ts";

test("an error is reported as not saved, with its reason", () => {
  assert.deepEqual(checkWrite({ data: null, error: { message: "permission denied" } }), {
    ok: false,
    message: "Not saved: permission denied",
  });
});

test("zero rows changed is not a success", () => {
  const r = checkWrite({ data: [], error: null }, "it was already released.");
  assert.deepEqual(r, { ok: false, message: "Not saved: it was already released." });
});

test("a confirmed write passes", () => {
  assert.equal(checkWrite({ data: [{ id: "x" }], error: null }), null);
});

test("helpers", () => {
  assert.deepEqual(saved("Approved."), { ok: true, message: "Approved." });
  assert.deepEqual(notSaved("x"), { ok: false, message: "Not saved: x" });
  assert.deepEqual(savedWithAudit("Approved.", null), { ok: true, message: "Approved." });
  assert.match(savedWithAudit("Approved.", "boom")!.message, /audit log entry failed: boom/);
});
