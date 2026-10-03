"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { RATE_FIELDS } from "@/lib/landed-cost";
import { saveImportRates } from "./actions";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Saving…" : "Save & mark checked today"}
    </Button>
  );
}

/**
 * The rates form: one field per rate, typed as a percent or dollars, plus
 * where the numbers came from. Values arrive pre-filled from the page.
 */
export function RatesForm({
  initial,
  sourceNote,
}: {
  initial: Record<string, string>;
  sourceNote: string;
}) {
  const [result, action] = useActionState(saveImportRates, null);

  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      {RATE_FIELDS.map((f) => (
        <label key={f.name} className="flex flex-col gap-1 text-sm text-gray-700">
          {f.label}
          <div className="flex items-center gap-2">
            {f.kind === "usd" ? <span className="text-base text-gray-500">$</span> : null}
            <input
              name={f.name}
              defaultValue={initial[f.name]}
              inputMode="decimal"
              autoComplete="off"
              required
              className="h-11 w-full max-w-[10rem] rounded border border-gray-200 bg-white px-3 font-mono text-base text-black"
            />
            {f.kind === "percent" ? <span className="text-base text-gray-500">%</span> : null}
          </div>
        </label>
      ))}

      <label className="flex flex-col gap-1 text-sm text-gray-700">
        Where these rates came from
        <textarea
          name="source_note"
          defaultValue={sourceNote}
          required
          maxLength={1000}
          rows={3}
          placeholder="e.g. Confirmed with [agent name], Apapa, on 12 Oct"
          className="rounded border border-gray-200 bg-white px-3 py-2 text-base text-black"
        />
      </label>

      {result?.ok === false ? (
        <p role="alert" className="text-sm text-red-700">
          {result.error}
        </p>
      ) : null}
      {result?.ok ? (
        <p role="status" className="text-sm text-green-700">
          Saved. {result.note}
        </p>
      ) : null}

      <SaveButton />
    </form>
  );
}
