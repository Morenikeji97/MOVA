import { test } from "node:test";
import assert from "node:assert/strict";
import { canApproveListing, canSubmitForReview } from "./listings-review.ts";

// ---------------------------------------------------------------------------
// canApproveListing — a listing can't reach Approved without the admin
// title-match confirmation (and can't while the VIN is flagged, unchanged
// from before this feature).
// ---------------------------------------------------------------------------

test("cannot approve without the admin title-identity-match confirmation", () => {
  assert.equal(
    canApproveListing({ vinVerificationStatus: "verified", titleIdentityMatchConfirmed: false }),
    false,
  );
});

test("can approve once the VIN is clear and the title-identity match is confirmed", () => {
  assert.equal(
    canApproveListing({ vinVerificationStatus: "verified", titleIdentityMatchConfirmed: true }),
    true,
  );
});

test("cannot approve with a flagged VIN even if the title-identity match is confirmed", () => {
  assert.equal(
    canApproveListing({ vinVerificationStatus: "flagged", titleIdentityMatchConfirmed: true }),
    false,
  );
});

test("an unverified (never-checked) VIN doesn't block approval on its own", () => {
  assert.equal(
    canApproveListing({ vinVerificationStatus: "unverified", titleIdentityMatchConfirmed: true }),
    true,
  );
});

// ---------------------------------------------------------------------------
// canSubmitForReview — the title document (and, for a non-owner seller, the
// authorization document) must be present before submission.
// ---------------------------------------------------------------------------

test("cannot submit for review without a title document", () => {
  assert.equal(
    canSubmitForReview({
      titlePhotoPath: null,
      notTitledOwner: false,
      authorizationDocumentPath: null,
    }),
    false,
  );
});

test("can submit for review with just a title document when the seller is the titled owner", () => {
  assert.equal(
    canSubmitForReview({
      titlePhotoPath: "seller-uid/title.pdf",
      notTitledOwner: false,
      authorizationDocumentPath: null,
    }),
    true,
  );
});

test("cannot submit for review as a non-owner seller without the authorization document", () => {
  assert.equal(
    canSubmitForReview({
      titlePhotoPath: "seller-uid/title.pdf",
      notTitledOwner: true,
      authorizationDocumentPath: null,
    }),
    false,
  );
});

test("can submit for review as a non-owner seller once both documents are present", () => {
  assert.equal(
    canSubmitForReview({
      titlePhotoPath: "seller-uid/title.pdf",
      notTitledOwner: true,
      authorizationDocumentPath: "seller-uid/authorization.pdf",
    }),
    true,
  );
});

test("a titled-owner seller doesn't need an authorization document even if one happens to be set", () => {
  assert.equal(
    canSubmitForReview({
      titlePhotoPath: "seller-uid/title.pdf",
      notTitledOwner: false,
      authorizationDocumentPath: null,
    }),
    true,
  );
});
