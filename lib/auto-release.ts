import type { MovaFeePaymentStatus } from "@/types/database";

/** How long a buyer has to complete the MOVA service fee once it's requested. */
export const AUTO_RELEASE_WINDOW_HOURS = 24;

/** Below this many hours to the deadline, admin sees "expires soon" styling. */
export const EXPIRING_SOON_THRESHOLD_HOURS = 3;

export type AutoReleaseState =
  | "not_started" // invoice not sent yet — no clock running
  | "active" // clock running, not close to the deadline
  | "expiring_soon" // clock running, within EXPIRING_SOON_THRESHOLD_HOURS of the deadline
  | "due_for_release" // deadline has passed — the cron job should expire this reservation
  | "paused"; // bank-transfer proof uploaded, awaiting admin — never expires on its own

export interface AutoReleaseInput {
  feePaymentRequestedAt: string | null;
  movaFeePaymentStatus: MovaFeePaymentStatus;
  /** Set when admin confirms or rejects a bank-transfer proof (0014). */
  bankTransferReviewedAt: string | null;
}

export interface AutoReleaseStatus {
  state: AutoReleaseState;
  deadline: Date | null;
  hoursRemaining: number | null;
}

/**
 * The abandoned-reservation timeout rule, shared by the release cron route
 * (app/api/cron/release-reservations/route.ts) and the admin/buyer UI, so
 * the rule is defined exactly once.
 *
 * Only meaningful for a reservation whose fee isn't paid yet — callers
 * should only invoke this when movaFeePaymentStatus !== 'paid' and the
 * reservation's status is still open (submitted/under_review/verified).
 *
 * Precedence:
 * 1. `pending_manual_verification` (bank-transfer proof uploaded, awaiting
 *    admin) — paused indefinitely, regardless of how long admin takes.
 * 2. `bank_transfer_rejected` — the buyer's prior proof was rejected; the
 *    clock restarts from that rejection (bankTransferReviewedAt) rather than
 *    staying paused forever on a stale upload, giving the buyer a fresh
 *    window to re-upload or switch to card.
 * 3. Otherwise the clock runs from feePaymentRequestedAt (the moment admin
 *    generated the fee invoice) — covers both the card path and the
 *    bank-transfer-with-no-proof-yet path identically, since both are the
 *    same "buyer was shown how to pay and hasn't acted" situation.
 */
export function getAutoReleaseStatus(
  input: AutoReleaseInput,
  now: Date,
): AutoReleaseStatus {
  if (input.movaFeePaymentStatus === "pending_manual_verification") {
    return { state: "paused", deadline: null, hoursRemaining: null };
  }

  const clockStart =
    input.movaFeePaymentStatus === "bank_transfer_rejected"
      ? input.bankTransferReviewedAt
      : input.feePaymentRequestedAt;

  if (clockStart == null) {
    return { state: "not_started", deadline: null, hoursRemaining: null };
  }

  const deadline = new Date(
    new Date(clockStart).getTime() + AUTO_RELEASE_WINDOW_HOURS * 60 * 60 * 1000,
  );
  const hoursRemaining = (deadline.getTime() - now.getTime()) / (60 * 60 * 1000);

  if (hoursRemaining <= 0) {
    return { state: "due_for_release", deadline, hoursRemaining: 0 };
  }
  if (hoursRemaining <= EXPIRING_SOON_THRESHOLD_HOURS) {
    return { state: "expiring_soon", deadline, hoursRemaining };
  }
  return { state: "active", deadline, hoursRemaining };
}
