"use client";

import { ActionForm, useActionPending } from "@/components/ui/action-form";

import { inputClasses } from "@/components/ui/input-classes";

import { type ComponentProps, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  canApproveListing,
  canSubmitForReview,
  NO_PHOTOS_APPROVAL_MESSAGE,
  VIN_NOT_VERIFIED_APPROVAL_MESSAGE,
} from "@/lib/listings-review";
import type { VinVerificationStatus } from "@/types/database";
import {
  approveListing,
  rejectListing,
  setTitleIdentityMatchConfirmed,
  setVinVerificationStatus,
} from "./actions";

const VIN_STATUS_LABEL: Record<VinVerificationStatus, string> = {
  unverified: "Unverified",
  checking: "Checking",
  verified: "Verified",
  flagged: "Flagged",
};

/**
 * Submit button that reads its parent <form>'s pending status so it disables
 * itself and shows a loading label while the server action runs, keeping a
 * double-click from firing the action twice.
 */
function PendingButton({
  children,
  pendingLabel,
  disabled,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel: string }) {
  const pending = useActionPending();
  return (
    <Button type="submit" disabled={pending || disabled} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

export function ReviewActions({
  vehicleId,
  vinVerificationStatus,
  hasTitleDocument,
  titleIdentityMatchConfirmed,
  notTitledOwner,
  hasAuthorizationDocument,
  photoCount,
}: {
  vehicleId: string;
  vinVerificationStatus: VinVerificationStatus;
  hasTitleDocument: boolean;
  titleIdentityMatchConfirmed: boolean;
  notTitledOwner: boolean;
  hasAuthorizationDocument: boolean;
  photoCount: number;
}) {
  const [rejecting, setRejecting] = useState(false);
  const vinFormRef = useRef<HTMLFormElement>(null);
  const identityFormRef = useRef<HTMLFormElement>(null);
  const flagged = vinVerificationStatus === "flagged";
  const blockedOnApproval = !canApproveListing({
    vinVerificationStatus,
    titleIdentityMatchConfirmed,
    photoCount,
  });
  // A listing can't reach 'pending_review' at all without these documents
  // (0031's CHECK constraints), so in practice this is always true here —
  // checked anyway rather than assumed, since it's what actually gates
  // whether the confirm checkbox makes sense to enable.
  const documentsReady = canSubmitForReview({
    hasTitleDocument,
    notTitledOwner,
    hasAuthorizationDocument,
  });

  return (
    <div className="mt-4 border-t border-line pt-4">
      <p className="text-sm text-muted">
        Check this VIN at{" "}
        <a
          href="https://www.nicb.org/vincheck"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink underline underline-offset-2"
        >
          nicb.org/vincheck
        </a>{" "}
        (theft/salvage) and{" "}
        <a
          href="https://vehiclehistory.gov"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink underline underline-offset-2"
        >
          vehiclehistory.gov
        </a>{" "}
        (NMVTIS title brand) before approving.
      </p>
      <ActionForm
        ref={vinFormRef}
        action={setVinVerificationStatus}
        className="mt-2 flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="id" value={vehicleId} />
        <label className="flex items-center gap-2 text-sm text-muted">
          VIN check result
          <select
            name="vin_verification_status"
            defaultValue={vinVerificationStatus}
            onChange={() => vinFormRef.current?.requestSubmit()}
            className={inputClasses()}
          >
            {(Object.keys(VIN_STATUS_LABEL) as VinVerificationStatus[]).map((s) => (
              <option key={s} value={s}>
                {VIN_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </ActionForm>
      {flagged ? (
        <p className="mt-2 text-sm text-copper-700">
          VIN flagged — this listing can&rsquo;t be approved until the status
          changes.
        </p>
      ) : vinVerificationStatus !== "verified" ? (
        <p className="mt-2 text-sm text-copper-700">{VIN_NOT_VERIFIED_APPROVAL_MESSAGE}</p>
      ) : null}

      <ActionForm
        ref={identityFormRef}
        action={setTitleIdentityMatchConfirmed}
        className="mt-3"
      >
        <input type="hidden" name="id" value={vehicleId} />
        <input
          type="hidden"
          name="title_identity_match_confirmed"
          value={(!titleIdentityMatchConfirmed).toString()}
        />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            defaultChecked={titleIdentityMatchConfirmed}
            disabled={!documentsReady}
            onChange={() => identityFormRef.current?.requestSubmit()}
            className="h-5 w-5 rounded-lg border-line"
          />
          {notTitledOwner
            ? "Title and authorization document names match seller’s verified identity"
            : "Title photo matches seller’s verified identity"}
        </label>
      </ActionForm>
      {!documentsReady ? (
        <p className="mt-1 text-sm text-copper-700">
          {!hasTitleDocument
            ? "No title photo uploaded yet — can’t confirm until the seller adds one."
            : "Seller says they’re not the titled owner, but hasn’t uploaded an authorization document yet — can’t confirm until they do."}
        </p>
      ) : !titleIdentityMatchConfirmed ? (
        <p className="mt-1 text-sm text-copper-700">
          Title identity unconfirmed — this listing can&rsquo;t be approved
          until it&rsquo;s checked.
        </p>
      ) : null}

      {rejecting ? (
        <ActionForm action={rejectListing} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={vehicleId} />
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">
              Reason for rejection <span className="text-copper-700">*</span>
            </span>
            <textarea
              name="rejection_reason"
              required
              rows={3}
              placeholder="Tell the seller what needs to change before this can be approved."
              className={inputClasses({ multiline: true })}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <PendingButton variant="primary" size="sm" pendingLabel="Rejecting…">
              Confirm rejection
            </PendingButton>
            <button
              type="button"
              onClick={() => setRejecting(false)}
              className="h-11 rounded-lg px-3 text-sm font-semibold text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </ActionForm>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <ActionForm action={approveListing}>
            <input type="hidden" name="id" value={vehicleId} />
            <PendingButton
              variant="primary"
              size="sm"
              pendingLabel="Approving…"
              disabled={blockedOnApproval}
            >
              Approve
            </PendingButton>
          </ActionForm>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setRejecting(true)}
          >
            Reject
          </Button>
          {photoCount === 0 ? (
            <p className="w-full text-sm text-copper-700">{NO_PHOTOS_APPROVAL_MESSAGE}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
