import { test } from "node:test";
import assert from "node:assert/strict";
import {
  badgeFacts,
  hasTitleReviewedBadge,
  hasVerifiedListingBadge,
  type ListingBadgeFacts,
} from "./listing-badges.ts";

/** A fully-verified listing; each test narrows one fact to prove it matters. */
function facts(overrides: Partial<ListingBadgeFacts> = {}): ListingBadgeFacts {
  return {
    titleIdentityMatchConfirmed: true,
    titleIdentityMatchConfirmedAt: "2026-09-27T12:00:00.000Z",
    hasTitleDocument: true,
    notTitledOwner: false,
    hasAuthorizationDocument: false,
    vinVerificationStatus: "verified",
    sellerIdentityVerified: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// hasTitleReviewedBadge
// ---------------------------------------------------------------------------

test("Title reviewed shows for a confirmed, timestamped, documented title", () => {
  assert.equal(hasTitleReviewedBadge(facts()), true);
});

test("Title reviewed is hidden when the confirmation flag is false", () => {
  assert.equal(
    hasTitleReviewedBadge(facts({ titleIdentityMatchConfirmed: false })),
    false,
  );
});

// The exact production defect: migration 0023's grandfather backfill set the
// flag true on every approved listing regardless of whether a title existed.
test("Title reviewed is hidden when confirmed but no title was ever uploaded", () => {
  assert.equal(
    hasTitleReviewedBadge(
      facts({ hasTitleDocument: false, titleIdentityMatchConfirmedAt: null }),
    ),
    false,
  );
});

test("Title reviewed is hidden when confirmed with no document even if timestamped", () => {
  assert.equal(hasTitleReviewedBadge(facts({ hasTitleDocument: false })), false);
});

test("Title reviewed is hidden when the confirmation has no timestamp", () => {
  assert.equal(
    hasTitleReviewedBadge(facts({ titleIdentityMatchConfirmedAt: null })),
    false,
  );
});

test("Title reviewed accepts a not-titled-owner backed by an authorization document", () => {
  assert.equal(
    hasTitleReviewedBadge(
      facts({
        hasTitleDocument: false,
        notTitledOwner: true,
        hasAuthorizationDocument: true,
      }),
    ),
    true,
  );
});

test("Title reviewed is hidden for a not-titled-owner with no authorization document", () => {
  assert.equal(
    hasTitleReviewedBadge(
      facts({
        hasTitleDocument: false,
        notTitledOwner: true,
        hasAuthorizationDocument: false,
      }),
    ),
    false,
  );
});

test("an authorization document alone doesn't stand in for a title when the seller claims to be the titled owner", () => {
  assert.equal(
    hasTitleReviewedBadge(
      facts({
        hasTitleDocument: false,
        notTitledOwner: false,
        hasAuthorizationDocument: true,
      }),
    ),
    false,
  );
});

// ---------------------------------------------------------------------------
// hasVerifiedListingBadge
// ---------------------------------------------------------------------------

test("Verified Listing shows only when identity, title and VIN all check out", () => {
  assert.equal(hasVerifiedListingBadge(facts()), true);
});

test("Verified Listing is hidden when the seller's identity isn't verified", () => {
  assert.equal(
    hasVerifiedListingBadge(facts({ sellerIdentityVerified: false })),
    false,
  );
});

test("Verified Listing is hidden when the title review doesn't hold up", () => {
  assert.equal(
    hasVerifiedListingBadge(facts({ hasTitleDocument: false })),
    false,
  );
});

test("Verified Listing is hidden when the VIN check was never run", () => {
  assert.equal(
    hasVerifiedListingBadge(facts({ vinVerificationStatus: "unverified" })),
    false,
  );
});

test("Verified Listing is hidden when the VIN check is still in progress", () => {
  assert.equal(
    hasVerifiedListingBadge(facts({ vinVerificationStatus: "checking" })),
    false,
  );
});

test("Verified Listing is hidden when the VIN was flagged", () => {
  assert.equal(
    hasVerifiedListingBadge(facts({ vinVerificationStatus: "flagged" })),
    false,
  );
});

// The archived 2003 Honda Accord that started this: approved, badge-bearing,
// and backed by nothing at all.
test("the 2003 Honda Accord regression case earns neither badge", () => {
  const honda = facts({
    titleIdentityMatchConfirmed: true,
    titleIdentityMatchConfirmedAt: null,
    hasTitleDocument: false,
    notTitledOwner: false,
    hasAuthorizationDocument: false,
    vinVerificationStatus: "unverified",
    sellerIdentityVerified: true,
  });
  assert.equal(hasTitleReviewedBadge(honda), false);
  assert.equal(hasVerifiedListingBadge(honda), false);
});

// ---------------------------------------------------------------------------
// badgeFacts — the DB row adapter
// ---------------------------------------------------------------------------

test("badgeFacts maps a selected row onto the rule input", () => {
  assert.deepEqual(
    badgeFacts({
      vin_verification_status: "verified",
      title_identity_match_confirmed: true,
      title_identity_match_confirmed_at: "2026-09-27T12:00:00.000Z",
      not_titled_owner: true,
      vehicle_has_title_document: false,
      vehicle_has_authorization_document: true,
      vehicle_seller_identity_verified: true,
    }),
    {
      titleIdentityMatchConfirmed: true,
      titleIdentityMatchConfirmedAt: "2026-09-27T12:00:00.000Z",
      hasTitleDocument: false,
      notTitledOwner: true,
      hasAuthorizationDocument: true,
      vinVerificationStatus: "verified",
      sellerIdentityVerified: true,
    },
  );
});
