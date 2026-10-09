"use client";

import { ActionForm, useActionPending } from "@/components/ui/action-form";

import { type ComponentProps, useState } from "react";
import { Button } from "@/components/ui/button";
import { approveDisputeForRefund, denyDispute, markRefundCompleted } from "./actions";
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

type Mode = null | "approve" | "deny";

export function DisputeActions({
  disputeId,
  status,
}: {
  disputeId: string;
  status: "open" | "approved_pending_refund";
}) {
  const [mode, setMode] = useState<Mode>(null);

  if (status === "approved_pending_refund") {
    return (
      <ActionForm action={markRefundCompleted} className="mt-4 border-t border-line pt-4">
        <input type="hidden" name="id" value={disputeId} />
        <PendingButton variant="primary" size="sm" pendingLabel="Recording…">
          Mark refund completed
        </PendingButton>
        <p className="mt-1 text-xs text-muted">
          Only after you&rsquo;ve actually processed the refund manually (Stripe
          dashboard, or a manual bank transfer) — this just records that it&rsquo;s done.
        </p>
      </ActionForm>
    );
  }

  if (mode === null) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button variant="primary" size="sm" onClick={() => setMode("approve")}>
          Approve for refund
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setMode("deny")}>
          Deny
        </Button>
      </div>
    );
  }

  const action = mode === "approve" ? approveDisputeForRefund : denyDispute;

  return (
    <ActionForm action={action} className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
      <input type="hidden" name="id" value={disputeId} />
      {mode === "approve" ? (
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">Refund amount (USD, optional)</span>
          <input
            type="number"
            name="decision_amount_usd"
            min="0"
            step="0.01"
            placeholder="e.g. 2000.00"
            className={inputClasses({ className: "w-48" })}
          />
        </label>
      ) : null}
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">
          {mode === "approve" ? "Reasoning" : "Reason"}{" "}
          <span className="text-copper-700">*</span>
          <span className="ml-1 font-normal text-muted">
            — shown to whoever filed this dispute
          </span>
        </span>
        <textarea
          name="decision_reason"
          required
          rows={3}
          className={inputClasses({ multiline: true })}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <PendingButton
          variant={mode === "approve" ? "primary" : "secondary"}
          size="sm"
          pendingLabel={mode === "approve" ? "Approving…" : "Denying…"}
        >
          {mode === "approve" ? "Confirm approval" : "Confirm denial"}
        </PendingButton>
        <button
          type="button"
          onClick={() => setMode(null)}
          className="h-11 rounded-lg px-3 text-sm font-semibold text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </ActionForm>
  );
}
