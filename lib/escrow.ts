import type { EscrowStage } from "@/types/database";

/**
 * ShipMova — Escrow.com stages an admin records on a transaction
 * (purchase_requests.escrow_stage, migration 0055), in order. Each change is
 * written to the transaction's stage history by a database trigger.
 * ShipMova never holds the vehicle price; these only record what Escrow.com
 * reports.
 */
export const ESCROW_STAGES: readonly { stage: EscrowStage; label: string }[] = [
  { stage: "escrow_opened", label: "Escrow opened" },
  { stage: "escrow_funded", label: "Buyer funded escrow" },
  { stage: "inspection_passed", label: "Inspection passed" },
  { stage: "handed_to_shipper", label: "Car and title handed to shipper" },
  { stage: "escrow_released", label: "Escrow released to seller" },
];

export function isEscrowStage(value: unknown): value is EscrowStage {
  return ESCROW_STAGES.some((s) => s.stage === value);
}

export function escrowStageLabel(stage: EscrowStage | null | undefined): string {
  return ESCROW_STAGES.find((s) => s.stage === stage)?.label ?? "Not opened";
}

/** Escrow.com's transaction reference as typed by staff: trimmed, ≤100 chars, or null. */
export function cleanEscrowReference(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  return v.length === 0 ? null : v.slice(0, 100);
}
