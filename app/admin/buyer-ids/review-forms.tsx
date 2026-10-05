"use client";

import { Button } from "@/components/ui/button";
import { ActionForm, useActionPending } from "@/components/ui/action-form";
import { inputClasses } from "@/components/ui/input-classes";
import { approveBuyerId, rejectBuyerId } from "./actions";

function Submit({ label, variant }: { label: string; variant?: "secondary" }) {
  const pending = useActionPending();
  return (
    <Button type="submit" variant={variant} disabled={pending} className="w-full sm:w-auto">
      {pending ? "Saving…" : label}
    </Button>
  );
}

/** Approve or reject one buyer's ID. Either way the ID photo is deleted. */
export function BuyerIdReviewForms({ buyerId }: { buyerId: string }) {
  return (
    <div className="mt-4 flex flex-col gap-4 border-t border-gray-200 pt-4">
      <ActionForm action={approveBuyerId}>
        <input type="hidden" name="buyer_id" value={buyerId} />
        <Submit label="Approve ID" />
      </ActionForm>
      <ActionForm action={rejectBuyerId} className="flex flex-col gap-2">
        <input type="hidden" name="buyer_id" value={buyerId} />
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-500">Reason (the buyer sees this)</span>
          <input name="note" required maxLength={1000} autoComplete="off" className={inputClasses()} />
        </label>
        <Submit label="Reject ID" variant="secondary" />
      </ActionForm>
    </div>
  );
}
