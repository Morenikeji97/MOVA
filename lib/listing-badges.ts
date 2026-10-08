import type { VinVerificationStatus } from "@/types/database";

/**
 * The facts a listing's verification badges are allowed to be derived from.
 *
 * Deliberately booleans and enums only — no document paths, no profile row.
 * `hasTitleDocument`, `hasAuthorizationDocument` and `sellerIdentityVerified`
 * come from columns added in migration 0036 (generated / trigger-maintained),
 * because title_photo_path/authorization_document_path aren't readable with
 * the anon key (0037) and seller_profiles is owner-or-admin under RLS.
 */
export interface ListingBadgeFacts {
  /** Admin ticked the title/identity name match. Admin-only column (0023). */
  titleIdentityMatchConfirmed: boolean;
  /** When that confirmation was recorded (0031). NULL for a confirmation no
   * admin actually made — see migration 0032's note on 0023's backfill. */
  titleIdentityMatchConfirmedAt: string | null;
  hasTitleDocument: boolean;
  notTitledOwner: boolean;
  hasAuthorizationDocument: boolean;
  vinVerificationStatus: VinVerificationStatus;
  /** Seller cleared Stripe Identity (seller_profiles.id_verification_status). */
  sellerIdentityVerified: boolean;
}

/**
 * Whether the "Title reviewed" badge may be shown.
 *
 * The confirmation flag alone is not enough: it must be backed by a document
 * the review could have been performed against, and by a timestamp proving a
 * real admin recorded it. Migration 0023's grandfather backfill set the flag
 * true for every already-approved listing without checking either, which is
 * how a listing with title_photo_path IS NULL came to advertise a title
 * review that never happened.
 *
 * Mirrored exactly by the DB constraint
 * vehicles_title_confirmation_requires_document (0032) — change one and you
 * must change the other.
 */
export function hasTitleReviewedBadge(facts: ListingBadgeFacts): boolean {
  if (!facts.titleIdentityMatchConfirmed) return false;
  if (facts.titleIdentityMatchConfirmedAt === null) return false;
  if (facts.hasTitleDocument) return true;
  return facts.notTitledOwner && facts.hasAuthorizationDocument;
}

/**
 * Whether the "Verified Listing" badge may be shown — every check ShipMova
 * claims to perform has actually been performed:
 *
 *   - the seller cleared identity verification,
 *   - the title (or authorization document) was reviewed against that
 *     identity, per hasTitleReviewedBadge above, and
 *   - the VIN check came back 'verified'.
 *
 * Notably NOT status = 'approved'. /browse/[id] previously rendered this
 * badge unconditionally, and because that page only ever shows approved
 * listings the badge silently meant "approved" — which is a moderation
 * outcome, not a verification result. 'unverified' VIN means "nobody ran the
 * check", so it does not qualify; only an explicit 'verified' does.
 *
 * vehicles.verification_status is intentionally not consulted: it has no
 * writer anywhere in the app and is 'unverified' on every row.
 */
export function hasVerifiedListingBadge(facts: ListingBadgeFacts): boolean {
  return (
    facts.sellerIdentityVerified &&
    hasTitleReviewedBadge(facts) &&
    facts.vinVerificationStatus === "verified"
  );
}

/**
 * The columns every badge-rendering surface must select, as a PostgREST
 * select-list fragment. Kept here next to the rule so a surface can't select
 * a subset and silently evaluate the rule against `undefined`.
 */
export const LISTING_BADGE_COLUMNS =
  "vin_verification_status, title_identity_match_confirmed, title_identity_match_confirmed_at, not_titled_owner, has_title_document, has_authorization_document, seller_identity_verified" as const;

/** Row shape produced by selecting LISTING_BADGE_COLUMNS. */
export interface ListingBadgeRow {
  vin_verification_status: VinVerificationStatus;
  title_identity_match_confirmed: boolean;
  title_identity_match_confirmed_at: string | null;
  not_titled_owner: boolean;
  has_title_document: boolean;
  has_authorization_document: boolean;
  seller_identity_verified: boolean;
}

/** Adapts a selected row to the rule input. */
export function badgeFacts(row: ListingBadgeRow): ListingBadgeFacts {
  return {
    titleIdentityMatchConfirmed: row.title_identity_match_confirmed,
    titleIdentityMatchConfirmedAt: row.title_identity_match_confirmed_at,
    hasTitleDocument: row.has_title_document,
    notTitledOwner: row.not_titled_owner,
    hasAuthorizationDocument: row.has_authorization_document,
    vinVerificationStatus: row.vin_verification_status,
    sellerIdentityVerified: row.seller_identity_verified,
  };
}

/** Statuses that never show a verification badge or a done check. */
const NO_BADGE_STATUSES: readonly string[] = ["archived"];

/**
 * Every verification badge/check for one listing, in one place, so the
 * seller's list, the browse cards and the listing page can't disagree.
 *
 * A removed listing (status 'archived') shows none of them (founder,
 * 2026-10-08): a badge advertises a car that's for sale, and a removed one
 * isn't. The underlying facts are untouched, so restoring a listing brings
 * its badges back.
 */
export function listingBadges(
  facts: ListingBadgeFacts,
  status: string,
): { verifiedListing: boolean; vinVerified: boolean; titleReviewed: boolean; sellerIdVerified: boolean } {
  if (NO_BADGE_STATUSES.includes(status)) {
    return { verifiedListing: false, vinVerified: false, titleReviewed: false, sellerIdVerified: false };
  }
  return {
    verifiedListing: hasVerifiedListingBadge(facts),
    vinVerified: facts.vinVerificationStatus === "verified",
    titleReviewed: hasTitleReviewedBadge(facts),
    sellerIdVerified: facts.sellerIdentityVerified,
  };
}
