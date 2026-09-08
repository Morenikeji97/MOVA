"use client";

import { type ComponentProps, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { moderateReview, dismissReports } from "@/app/reviews/actions";

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

export function ModerationActions({
  reviewId,
  isFlagged,
}: {
  reviewId: string;
  isFlagged: boolean;
}) {
  const [removing, setRemoving] = useState(false);

  return (
    <div className="mt-4 flex flex-wrap items-start gap-3 border-t border-paper-200 pt-4">
      {removing ? (
        <form action={moderateReview} className="flex w-full flex-col gap-2">
          <input type="hidden" name="id" value={reviewId} />
          <input type="hidden" name="action" value="remove" />
          <textarea
            name="note"
            rows={2}
            placeholder="Internal note (optional) — why this was removed."
            className="rounded border border-paper-200 bg-paper-100 px-3 py-2 text-sm text-ink-900"
          />
          <div className="flex items-center gap-3">
            <PendingButton variant="primary" size="sm" pendingLabel="Removing…">
              Confirm remove
            </PendingButton>
            <button
              type="button"
              onClick={() => setRemoving(false)}
              className="text-sm text-slate-500 hover:text-ink-900"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <form action={moderateReview}>
            <input type="hidden" name="id" value={reviewId} />
            <input type="hidden" name="action" value="publish" />
            <PendingButton variant="primary" size="sm" pendingLabel="Publishing…">
              Publish
            </PendingButton>
          </form>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setRemoving(true)}
          >
            Remove
          </Button>
          {isFlagged ? (
            <form action={dismissReports}>
              <input type="hidden" name="reviewId" value={reviewId} />
              <PendingButton variant="ghost" size="sm" pendingLabel="Dismissing…">
                Keep &amp; dismiss reports
              </PendingButton>
            </form>
          ) : null}
        </>
      )}
    </div>
  );
}
