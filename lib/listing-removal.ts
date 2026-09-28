import type { MovaFeePaymentStatus, PurchaseRequestStatus, VehicleStatus } from "@/types/database";

/**
 * MOVA — the rule for "may this seller take their own listing down?".
 *
 * Mirrors the DB guard added in migration 0035
 * (vehicles_guard_admin_only_fields + vehicle_has_active_buyer), which is the
 * real enforcement point; this exists so the UI can hide or explain the
 * button instead of firing an update that raises.
 */

/**
 * Statuses a seller may withdraw from. Deliberately excludes 'sold' (a
 * completed sale isn't withdrawn after the fact) and 'archived' (already
 * withdrawn — and un-archiving stays admin-only, so a removed listing can't
 * quietly reappear without a fresh review).
 */
export const SELLER_ARCHIVABLE_STATUSES: readonly VehicleStatus[] = [
  "draft",
  "pending_review",
  "approved",
  "rejected",
];

/**
 * Reservation statuses that count as a live reservation — the same "still
 * open" set the abandoned-reservation cron (migration 0020) and
 * lib/auto-release.ts use, so the system has one definition of this.
 */
export const ACTIVE_PURCHASE_REQUEST_STATUSES: readonly PurchaseRequestStatus[] = [
  "submitted",
  "under_review",
  "verified",
];

/**
 * Fee states that mean money is in play: paid outright, or a bank transfer
 * whose proof is sitting with admin.
 */
export const ACTIVE_FEE_PAYMENT_STATUSES: readonly MovaFeePaymentStatus[] = [
  "paid",
  "pending_manual_verification",
];

export interface PurchaseRequestSnapshot {
  status: PurchaseRequestStatus;
  mova_fee_payment_status: MovaFeePaymentStatus;
}

/**
 * Whether a buyer is mid-transaction on this vehicle. The fee clause is
 * separate from the status clause on purpose: today any paid fee sits on a
 * request in one of the open statuses, but stating it outright means a later
 * change to the status flow can't quietly make it possible to withdraw a car
 * someone has already paid MOVA for.
 */
export function hasActiveBuyer(requests: PurchaseRequestSnapshot[]): boolean {
  return requests.some(
    (r) =>
      ACTIVE_PURCHASE_REQUEST_STATUSES.includes(r.status) ||
      (ACTIVE_FEE_PAYMENT_STATUSES.includes(r.mova_fee_payment_status) &&
        r.status !== "completed"),
  );
}

export type RemovalBlockReason = "wrong_status" | "active_buyer";

export type RemovalCheck =
  | { allowed: true }
  | { allowed: false; reason: RemovalBlockReason; message: string };

/** The buyer-in-progress message, specified verbatim. */
export const ACTIVE_BUYER_MESSAGE =
  "This car has an active buyer, contact MOVA on WhatsApp to cancel.";

export function canSellerArchive(listing: {
  status: VehicleStatus;
  purchaseRequests: PurchaseRequestSnapshot[];
}): RemovalCheck {
  if (!SELLER_ARCHIVABLE_STATUSES.includes(listing.status)) {
    return {
      allowed: false,
      reason: "wrong_status",
      message:
        listing.status === "sold"
          ? "This listing has already sold and can't be removed."
          : "This listing has already been removed.",
    };
  }
  if (hasActiveBuyer(listing.purchaseRequests)) {
    return { allowed: false, reason: "active_buyer", message: ACTIVE_BUYER_MESSAGE };
  }
  return { allowed: true };
}
