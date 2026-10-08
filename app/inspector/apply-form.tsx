"use client";

import { ActionForm, useActionPending } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input-classes";
import { US_STATES } from "@/lib/us-states";
import { applyAsInspector } from "./actions";

function Submit() {
  const pending = useActionPending();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Sending…" : "Apply"}
    </Button>
  );
}

export function ApplyForm() {
  return (
    <ActionForm action={applyAsInspector} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">Full name</span>
        <input name="full_name" required autoComplete="name" className={inputClasses()} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">Phone</span>
        <input name="phone" type="tel" required inputMode="tel" autoComplete="tel" className={inputClasses()} />
      </label>
      <fieldset>
        <legend className="text-sm text-muted">States you can inspect in</legend>
        <div className="mt-2 grid max-h-80 grid-cols-2 gap-x-3 overflow-y-auto rounded-lg border border-line px-3 sm:grid-cols-3">
          {US_STATES.map(([code, name]) => (
            <label key={code} className="flex h-11 items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="service_states" value={code} className="h-5 w-5 shrink-0 accent-ink" />
              {name}
            </label>
          ))}
        </div>
      </fieldset>
      <Submit />
    </ActionForm>
  );
}
