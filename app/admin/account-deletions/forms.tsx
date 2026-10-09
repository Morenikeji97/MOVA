"use client";

import { useState } from "react";
import { ActionForm, useActionPending } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input-classes";
import { deleteAccountAction, refuseAccountDeletionAction } from "./actions";

function Pending({ idle, busy, variant = "primary" }: { idle: string; busy: string; variant?: "primary" | "secondary" }) {
  const pending = useActionPending();
  return (
    <Button type="submit" variant={variant} disabled={pending} className="w-full sm:w-auto">
      {pending ? busy : idle}
    </Button>
  );
}

/** Delete needs a second tap; Refuse needs a reason. */
export function DeletionDecision({ requestId }: { requestId: string }) {
  const [mode, setMode] = useState<null | "delete" | "refuse">(null);
  if (mode === "delete") {
    return (
      <ActionForm action={deleteAccountAction} className="mt-4 flex flex-col gap-2 rounded-lg border border-copper-100 bg-copper-50 p-4">
        <input type="hidden" name="id" value={requestId} />
        <p className="text-sm text-copper-700">
          Delete this account? Personal details are cleared, listings archived and the sign-in removed. This can&rsquo;t be undone.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Pending idle="Yes, delete it" busy="Deleting…" />
          <button type="button" onClick={() => setMode(null)} className="h-11 rounded-lg px-3 text-sm font-semibold text-muted hover:text-ink">
            Cancel
          </button>
        </div>
      </ActionForm>
    );
  }
  if (mode === "refuse") {
    return (
      <ActionForm action={refuseAccountDeletionAction} className="mt-4 flex flex-col gap-2">
        <input type="hidden" name="id" value={requestId} />
        <label className="flex flex-col gap-1 text-sm text-muted">
          Why (kept with the request)
          <textarea name="note" required rows={2} maxLength={1000} className={inputClasses({ multiline: true })} />
        </label>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Pending idle="Refuse" busy="Saving…" variant="secondary" />
          <button type="button" onClick={() => setMode(null)} className="h-11 rounded-lg px-3 text-sm font-semibold text-muted hover:text-ink">
            Cancel
          </button>
        </div>
      </ActionForm>
    );
  }
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:flex">
      <Button type="button" onClick={() => setMode("delete")} className="w-full sm:w-auto">
        Delete account
      </Button>
      <Button type="button" variant="secondary" onClick={() => setMode("refuse")} className="w-full sm:w-auto">
        Refuse
      </Button>
    </div>
  );
}
