"use client";

import { type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  markReservationUnderReview,
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
}: {
  requestId: string;
  canReview: boolean;
  canRequestFee: boolean;
  shippingSelected: boolean;
  feeLinkSent: boolean;
  feePaid: boolean;
}) {
  // canRequestFee already requires status + shipping, so this only fires for
  // "otherwise eligible, but the buyer hasn't picked a shipper yet."
  const blockedOnShipping = !canRequestFee && !feePaid && !shippingSelected;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-paper-200 pt-4">
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
    </div>
  );
}
