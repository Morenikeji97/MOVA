import { test } from "node:test";
import assert from "node:assert/strict";
import { excludeIds, inList } from "./test-accounts.ts";

test("inList builds a PostgREST in-list", () => {
  assert.equal(inList(["a", "b"]), "(a,b)");
});

test("excludeIds adds a not-in filter only when there are ids", () => {
  const calls: unknown[][] = [];
  const q = { not(...args: unknown[]) { calls.push(args); return q; } };
  excludeIds(q, "buyer_id", []);
  assert.equal(calls.length, 0);
  excludeIds(q, "buyer_id", ["u1", "u2"]);
  assert.deepEqual(calls, [["buyer_id", "in", "(u1,u2)"]]);
});
