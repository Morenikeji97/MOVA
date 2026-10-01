import type { VinVerificationStatus } from "@/types/database";

/**
 * Whether a pending-review listing is actually eligible for the "Approve"
 * button — the same rule the DB enforces as a hard backstop via
 * vehicles_vin_verified_before_approval (0047),
 * vehicles_title_identity_confirmed_before_approval (0023) and
 * vehicles_require_photo_to_approve (0044): the VIN check must be
 * 'verified' (not just "not flagged"), the title-identity match confirmed,
 * and at least one photo attached. Shared so the
 * admin UI's disabled state (components: app/admin/listings/review-actions.tsx)
 * and the server action's own filter (app/admin/listings/actions.ts) can't
 * drift apart.
 */
export function canApproveListing(gate: {
  vinVerificationStatus: VinVerificationStatus;
  titleIdentityMatchConfirmed: boolean;
  /** Photos on the listing — at least one is required (vehicles_require_photo_to_approve, 0044). */
  photoCount: number;
}): boolean {
  return (
    gate.vinVerificationStatus === "verified" &&
    gate.titleIdentityMatchConfirmed &&
    gate.photoCount > 0
  );
}

/** Shown on the admin page when the VIN check isn't 'verified' yet. */
export const VIN_NOT_VERIFIED_APPROVAL_MESSAGE =
  "VIN not verified — set the VIN check result to Verified before approving.";

/** Shown on the admin page when a listing can't be approved for lack of photos. */
export const NO_PHOTOS_APPROVAL_MESSAGE =
  "This listing has no photos — it can't be approved until the seller adds at least one.";

/**
 * Whether a draft listing has everything it needs to move to
 * 'pending_review' — mirrors the DB CHECK constraints added in 0031
 * (vehicles_title_photo_required_before_review /
 * vehicles_authorization_doc_required_before_review): a title document is
 * always required, and a second (authorization/POA) document is required
 * whenever the seller has declared they aren't the titled owner.
 *
 * Takes presence flags rather than paths: callers read them from the
 * has_title_document / has_authorization_document columns (0036), since the
 * paths themselves aren't readable with the anon key (0037).
 */
export function canSubmitForReview(gate: {
  hasTitleDocument: boolean;
  notTitledOwner: boolean;
  hasAuthorizationDocument: boolean;
}): boolean {
  if (!gate.hasTitleDocument) return false;
  if (gate.notTitledOwner && !gate.hasAuthorizationDocument) return false;
  return true;
}
