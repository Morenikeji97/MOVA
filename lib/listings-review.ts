import type { VinVerificationStatus } from "@/types/database";

/**
 * Whether a pending-review listing is actually eligible for the "Approve"
 * button — the same rule the DB enforces as a hard backstop via
 * vehicles_flagged_not_approved (0007) and
 * vehicles_title_identity_confirmed_before_approval (0023): a flagged VIN
 * or an unconfirmed title-identity match blocks approval. Shared so the
 * admin UI's disabled state (components: app/admin/listings/review-actions.tsx)
 * and the server action's own filter (app/admin/listings/actions.ts) can't
 * drift apart.
 */
export function canApproveListing(gate: {
  vinVerificationStatus: VinVerificationStatus;
  titleIdentityMatchConfirmed: boolean;
}): boolean {
  return gate.vinVerificationStatus !== "flagged" && gate.titleIdentityMatchConfirmed;
}

/**
 * Whether a draft listing has everything it needs to move to
 * 'pending_review' — mirrors the DB CHECK constraints added in 0031
 * (vehicles_title_photo_required_before_review /
 * vehicles_authorization_doc_required_before_review): a title document is
 * always required, and a second (authorization/POA) document is required
 * whenever the seller has declared they aren't the titled owner.
 */
export function canSubmitForReview(gate: {
  titlePhotoPath: string | null;
  notTitledOwner: boolean;
  authorizationDocumentPath: string | null;
}): boolean {
  if (!gate.titlePhotoPath) return false;
  if (gate.notTitledOwner && !gate.authorizationDocumentPath) return false;
  return true;
}
