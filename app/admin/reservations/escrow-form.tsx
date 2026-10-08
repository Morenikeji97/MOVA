"use client";

import type { EscrowStage } from "@/types/database";
import { Button } from "@/components/ui/button";
import { ActionForm, useActionPending } from "@/components/ui/action-form";
import { inputClasses } from "@/components/ui/input-classes";
import { ESCROW_STAGES } from "@/lib/escrow";
import { recordEscrow } from "./actions";

function SaveButton() {
  const pending = useActionPending();
  return (
    <Button type="submit" variant="secondary" disabled={pending} className="self-start">
      {pending ? "Saving…" : "Save escrow details"}
    </Button>
  );
}

/** Escrow.com reference + stage for one transaction, as an admin records them. */
export function EscrowForm({
  requestId,
  escrowReference,
  escrowStage,
}: {
  requestId: string;
  escrowReference: string | null;
  escrowStage: EscrowStage | null;
}) {
  return (
    <ActionForm action={recordEscrow} className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
      <input type="hidden" name="id" value={requestId} />
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Escrow.com</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">Escrow.com reference</span>
          <input
            name="escrow_reference"
            defaultValue={escrowReference ?? ""}
            maxLength={100}
            // Browsers restore typed values on reload; off keeps the field
            // showing what's actually saved.
            autoComplete="off"
            className={inputClasses({ className: "font-mono" })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">Stage</span>
          <select
            name="escrow_stage"
            defaultValue={escrowStage ?? ""}
            autoComplete="off"
            className={inputClasses()}
          >
            <option value="">Not opened</option>
            {ESCROW_STAGES.map((s) => (
              <option key={s.stage} value={s.stage}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <SaveButton />
    </ActionForm>
  );
}
