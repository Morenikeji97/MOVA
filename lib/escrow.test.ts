import { test } from "node:test";
import assert from "node:assert/strict";
import { ESCROW_STAGES, cleanEscrowReference, escrowStageLabel, isEscrowStage } from "./escrow.ts";

test("escrow stages run in the order the money moves", () => {
  assert.deepEqual(
    ESCROW_STAGES.map((s) => s.stage),
    ["escrow_opened", "escrow_funded", "inspection_passed", "handed_to_shipper", "escrow_released"],
  );
});

test("only known stages are accepted", () => {
  assert.equal(isEscrowStage("escrow_funded"), true);
  assert.equal(isEscrowStage("escrow_refunded"), false);
  assert.equal(isEscrowStage(""), false);
});

test("labels, with a default for none", () => {
  assert.equal(escrowStageLabel("inspection_passed"), "Inspection passed");
  assert.equal(escrowStageLabel(null), "Not opened");
});

test("escrow references are trimmed, capped, and blank means none", () => {
  assert.equal(cleanEscrowReference("  ESC-123 "), "ESC-123");
  assert.equal(cleanEscrowReference("   "), null);
  assert.equal(cleanEscrowReference(undefined), null);
  assert.equal(cleanEscrowReference("x".repeat(150))?.length, 100);
});
