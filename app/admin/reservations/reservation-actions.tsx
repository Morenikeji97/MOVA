"use client";

import { type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { markReservationUnderReview, releaseReservation } from "./actions";

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
}: {
  requestId: string;
  canReview: boolean;
}) {
  return (
    <div className="mt-4 flex items-center gap-3 border-t border-paper-200 pt-4">
      {canReview ? (
        <form action={markReservationUnderReview}>
          <input type="hidden" name="id" value={requestId} />
          <PendingButton variant="secondary" size="sm" pendingLabel="Updating…">
            Mark under review
          </PendingButton>
        </form>
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
