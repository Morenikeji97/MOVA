"use client";

import { type ComponentProps, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { VinVerificationStatus } from "@/types/database";
import { approveListing, rejectListing, setVinVerificationStatus } from "./actions";

const VIN_STATUS_LABEL: Record<VinVerificationStatus, string> = {
  unverified: "Unverified",
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
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

export function ReviewActions({
  vehicleId,
  vinVerificationStatus,
}: {
  vehicleId: string;
  vinVerificationStatus: VinVerificationStatus;
}) {
  const [rejecting, setRejecting] = useState(false);
  const vinFormRef = useRef<HTMLFormElement>(null);
  const flagged = vinVerificationStatus === "flagged";

  return (
    <div className="mt-4 border-t border-paper-200 pt-4">
      <form
        ref={vinFormRef}
        action={setVinVerificationStatus}
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="id" value={vehicleId} />
        <label className="flex items-center gap-2 text-sm text-slate-500">
          VIN check (NICB / NMVTIS, run outside the app)
          <select
            name="vin_verification_status"
            defaultValue={vinVerificationStatus}
            onChange={() => vinFormRef.current?.requestSubmit()}
            className="h-9 rounded border border-paper-200 bg-paper-100 px-2 text-sm text-ink-900"
          >
            {(Object.keys(VIN_STATUS_LABEL) as VinVerificationStatus[]).map((s) => (
              <option key={s} value={s}>
                {VIN_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </form>
      {flagged ? (
        <p className="mt-2 text-sm text-copper-700">
          VIN flagged — this listing can&rsquo;t be approved until the status
          changes.
        </p>
      ) : null}

      {rejecting ? (
        <form action={rejectListing} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={vehicleId} />
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-500">
              Reason for rejection <span className="text-copper-700">*</span>
            </span>
            <textarea
              name="rejection_reason"
              required
              rows={3}
              placeholder="Tell the seller what needs to change before this can be approved."
              className="rounded border border-paper-200 bg-paper-100 px-3 py-2 text-ink-900"
            />
          </label>
          <div className="flex items-center gap-3">
            <PendingButton variant="primary" size="sm" pendingLabel="Rejecting…">
              Confirm rejection
            </PendingButton>
            <button
              type="button"
              onClick={() => setRejecting(false)}
              className="text-sm text-slate-500 hover:text-ink-900"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-3">
          <form action={approveListing}>
            <input type="hidden" name="id" value={vehicleId} />
            <PendingButton
              variant="primary"
              size="sm"
              pendingLabel="Approving…"
              disabled={flagged}
            >
              Approve
            </PendingButton>
          </form>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setRejecting(true)}
          >
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
