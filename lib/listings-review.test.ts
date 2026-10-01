import { test } from "node:test";
import assert from "node:assert/strict";
import { canApproveListing, canSubmitForReview } from "./listings-review.ts";

// ---------------------------------------------------------------------------
// canApproveListing — a listing can't reach Approved without the admin
// title-match confirmation, and needs a VIN check result of 'verified' (0047).
// ---------------------------------------------------------------------------

test("cannot approve without the admin title-identity-match confirmation", () => {
  assert.equal(
    canApproveListing({ vinVerificationStatus: "verified", titleIdentityMatchConfirmed: false, photoCount: 3 }),
    false,
  );
});

test("can approve once the VIN is clear and the title-identity match is confirmed", () => {
  assert.equal(
    canApproveListing({ vinVerificationStatus: "verified", titleIdentityMatchConfirmed: true, photoCount: 3 }),
    true,
  );
});

test("cannot approve with a flagged VIN even if the title-identity match is confirmed", () => {
  assert.equal(
    canApproveListing({ vinVerificationStatus: "flagged", titleIdentityMatchConfirmed: true, photoCount: 3 }),
    false,
  );
});

test("an unverified or still-checking VIN blocks approval (0047)", () => {
  for (const vin of ["unverified", "checking"] as const) {
    assert.equal(
      canApproveListing({ vinVerificationStatus: vin, titleIdentityMatchConfirmed: true, photoCount: 3 }),
      false,
      vin,
    );
  }
});

test("cannot approve a listing with zero photos, even when everything else is clear", () => {
  assert.equal(
    canApproveListing({ vinVerificationStatus: "verified", titleIdentityMatchConfirmed: true, photoCount: 0 }),
    false,
  );
});

// ---------------------------------------------------------------------------
// canSubmitForReview — the title document (and, for a non-owner seller, the
// authorization document) must be present before submission.
// ---------------------------------------------------------------------------

test("cannot submit for review without a title document", () => {
  assert.equal(
    canSubmitForReview({
      hasTitleDocument: false,
      notTitledOwner: false,
      hasAuthorizationDocument: false,
    }),
    false,
  );
});

test("can submit for review with just a title document when the seller is the titled owner", () => {
  assert.equal(
    canSubmitForReview({
      hasTitleDocument: true,
      notTitledOwner: false,
      hasAuthorizationDocument: false,
    }),
    true,
  );
});

test("cannot submit for review as a non-owner seller without the authorization document", () => {
  assert.equal(
    canSubmitForReview({
      hasTitleDocument: true,
      notTitledOwner: true,
      hasAuthorizationDocument: false,
    }),
    false,
  );
});

test("can submit for review as a non-owner seller once both documents are present", () => {
  assert.equal(
    canSubmitForReview({
      hasTitleDocument: true,
      notTitledOwner: true,
      hasAuthorizationDocument: true,
    }),
    true,
  );
});

test("a titled-owner seller doesn't need an authorization document even if one happens to be set", () => {
  assert.equal(
    canSubmitForReview({
      hasTitleDocument: true,
      notTitledOwner: false,
      hasAuthorizationDocument: false,
    }),
    true,
  );
});
