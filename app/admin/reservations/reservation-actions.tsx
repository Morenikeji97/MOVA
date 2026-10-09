"use client";

import { ActionForm, useActionPending } from "@/components/ui/action-form";

import { type ComponentProps, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  confirmBankTransferPayment,
  markReservationUnderReview,
  rejectBankTransferPayment,
  releaseReservation,
  requestFeePayment,
} from "./actions";
import { inputClasses } from "@/components/ui/input-classes";

function PendingButton({
  children,
  pendingLabel,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel: string }) {
  const pending = useActionPending();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

export function ReservationActions({
  requestId,
  canReview,
  canRequestFee,
  shippingSelected,
  feeLinkSent,
  feePaid,
  awaitingBankVerification,
  prelaunch,
}: {
  requestId: string;
  canReview: boolean;
  canRequestFee: boolean;
  shippingSelected: boolean;
  feeLinkSent: boolean;
  feePaid: boolean;
  awaitingBankVerification: boolean;
  /** PRELAUNCH is on: requestFeePayment refuses, so don't offer it. */
  prelaunch: boolean;
}) {
  // canRequestFee already requires status + shipping, so this only fires for
  // "otherwise eligible, but the buyer hasn't picked a shipper yet."
  const blockedOnShipping = !canRequestFee && !feePaid && !shippingSelected;
  const [rejectingBankTransfer, setRejectingBankTransfer] = useState(false);

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
      {canReview ? (
        <ActionForm action={markReservationUnderReview}>
          <input type="hidden" name="id" value={requestId} />
          <PendingButton variant="secondary" size="sm" pendingLabel="Updating…">
            Mark under review
          </PendingButton>
        </ActionForm>
      ) : null}
      {canRequestFee && prelaunch ? (
        <span className="text-sm text-copper-700">
          Pre-launch: fee payment links are switched off until ShipMova launches.
        </span>
      ) : null}
      {canRequestFee && !prelaunch ? (
        <ActionForm action={requestFeePayment}>
          <input type="hidden" name="id" value={requestId} />
          <PendingButton variant="secondary" size="sm" pendingLabel="Generating…">
            {feeLinkSent ? "Regenerate fee link" : "Request fee payment"}
          </PendingButton>
        </ActionForm>
      ) : null}
      {blockedOnShipping ? (
        <span className="text-sm text-copper-700">
          Waiting on the buyer to select a shipper before an invoice can be sent.
        </span>
      ) : null}

      {awaitingBankVerification && !rejectingBankTransfer ? (
        <>
          <ActionForm action={confirmBankTransferPayment}>
            <input type="hidden" name="id" value={requestId} />
            <PendingButton variant="primary" size="sm" pendingLabel="Confirming…">
              Payment confirmed
            </PendingButton>
          </ActionForm>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setRejectingBankTransfer(true)}
          >
            Rejected / not received
          </Button>
        </>
      ) : null}
      {feePaid ? (
        <span className="text-sm font-medium text-verified-600">
          Service fee paid
        </span>
      ) : null}

      <ActionForm action={releaseReservation}>
        <input type="hidden" name="id" value={requestId} />
        <PendingButton variant="primary" size="sm" pendingLabel="Releasing…">
          Release
        </PendingButton>
      </ActionForm>

      {rejectingBankTransfer ? (
        <ActionForm
          action={rejectBankTransferPayment}
          className="flex w-full flex-col gap-2 pt-1"
        >
          <input type="hidden" name="id" value={requestId} />
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">
              Reason (shown to the buyer) <span className="text-copper-700">*</span>
            </span>
            <textarea
              name="rejection_reason"
              required
              rows={2}
              placeholder="e.g. amount doesn't match, reference code missing, transfer not received yet"
              className={inputClasses({ multiline: true })}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <PendingButton variant="primary" size="sm" pendingLabel="Rejecting…">
              Confirm rejection
            </PendingButton>
            <button
              type="button"
              onClick={() => setRejectingBankTransfer(false)}
              className="h-11 rounded-lg px-3 text-sm font-semibold text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </ActionForm>
      ) : null}
    </div>
  );
}
