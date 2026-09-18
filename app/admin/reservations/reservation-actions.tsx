"use client";

import { type ComponentProps, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  confirmBankTransferPayment,
  markReservationUnderReview,
  rejectBankTransferPayment,
  releaseReservation,
  requestFeePayment,
} from "./actions";

function PendingButton({
  children,
  pendingLabel,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel: string }) {
  const { pending } = useFormStatus();
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
}: {
  requestId: string;
  canReview: boolean;
  canRequestFee: boolean;
  shippingSelected: boolean;
  feeLinkSent: boolean;
  feePaid: boolean;
  awaitingBankVerification: boolean;
}) {
  // canRequestFee already requires status + shipping, so this only fires for
  // "otherwise eligible, but the buyer hasn't picked a shipper yet."
  const blockedOnShipping = !canRequestFee && !feePaid && !shippingSelected;
  const [rejectingBankTransfer, setRejectingBankTransfer] = useState(false);

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-200 pt-4">
      {canReview ? (
        <form action={markReservationUnderReview}>
          <input type="hidden" name="id" value={requestId} />
          <PendingButton variant="secondary" size="sm" pendingLabel="Updating…">
            Mark under review
          </PendingButton>
        </form>
      ) : null}
      {canRequestFee ? (
        <form action={requestFeePayment}>
          <input type="hidden" name="id" value={requestId} />
          <PendingButton variant="secondary" size="sm" pendingLabel="Generating…">
            {feeLinkSent ? "Regenerate fee link" : "Request fee payment"}
          </PendingButton>
        </form>
      ) : null}
      {blockedOnShipping ? (
        <span className="text-sm text-copper-700">
          Waiting on the buyer to select a shipper before an invoice can be sent.
        </span>
      ) : null}

      {awaitingBankVerification && !rejectingBankTransfer ? (
        <>
          <form action={confirmBankTransferPayment}>
            <input type="hidden" name="id" value={requestId} />
            <PendingButton variant="primary" size="sm" pendingLabel="Confirming…">
              Payment confirmed
            </PendingButton>
          </form>
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

      <form action={releaseReservation}>
        <input type="hidden" name="id" value={requestId} />
        <PendingButton variant="primary" size="sm" pendingLabel="Releasing…">
          Release
        </PendingButton>
      </form>

      {rejectingBankTransfer ? (
        <form
          action={rejectBankTransferPayment}
          className="flex w-full flex-col gap-2 pt-1"
        >
          <input type="hidden" name="id" value={requestId} />
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500">
              Reason (shown to the buyer) <span className="text-copper-700">*</span>
            </span>
            <textarea
              name="rejection_reason"
              required
              rows={2}
              placeholder="e.g. amount doesn't match, reference code missing, transfer not received yet"
              className="rounded border border-gray-200 bg-white px-3 py-2 text-sm text-black"
            />
          </label>
          <div className="flex items-center gap-3">
            <PendingButton variant="primary" size="sm" pendingLabel="Rejecting…">
              Confirm rejection
            </PendingButton>
            <button
              type="button"
              onClick={() => setRejectingBankTransfer(false)}
              className="text-sm text-gray-500 hover:text-black"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
