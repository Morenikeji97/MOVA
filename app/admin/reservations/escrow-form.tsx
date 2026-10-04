"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { EscrowStage } from "@/types/database";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input-classes";
import { ESCROW_STAGES } from "@/lib/escrow";
import { recordEscrow } from "./actions";

function SaveButton() {
  const { pending } = useFormStatus();
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
  const [result, formAction] = useActionState(recordEscrow, null);
  return (
    <form
      action={formAction}
      // Browsers restore typed values on reload; autoComplete off keeps the
      // fields showing what's actually saved.
      autoComplete="off"
      className="mt-4 flex flex-col gap-3 border-t border-gray-200 pt-4"
    >
      <input type="hidden" name="id" value={requestId} />
      <p className="font-mono text-xs uppercase tracking-wider text-gray-500">Escrow.com</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-500">Escrow.com reference</span>
          <input
            name="escrow_reference"
            defaultValue={escrowReference ?? ""}
            maxLength={100}
            autoComplete="off"
            className={inputClasses({ className: "font-mono" })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-500">Stage</span>
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
      {result ? (
        <p className={`text-sm ${result.ok ? "text-verified-600" : "text-copper-700"}`}>
          {result.message}
        </p>
      ) : null}
    </form>
  );
}
