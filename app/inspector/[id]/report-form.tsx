"use client";

import { ActionForm, useActionPending } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input-classes";
import { submitInspection } from "../actions";

function Submit({ disabled }: { disabled: boolean }) {
  const pending = useActionPending();
  return (
    <Button type="submit" disabled={pending || disabled} className="w-full sm:w-auto">
      {pending ? "Sending…" : "Send report to ShipMova"}
    </Button>
  );
}

export function ReportForm({ inspectionId, ready }: { inspectionId: string; ready: boolean }) {
  return (
    <ActionForm action={submitInspection} className="flex flex-col gap-4">
      <input type="hidden" name="inspection_id" value={inspectionId} />
      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-500">VIN on the car (17 characters)</span>
        <input name="vin_read" required maxLength={17} autoComplete="off" autoCapitalize="characters" className={inputClasses({ className: "font-mono" })} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-500">Odometer (miles)</span>
        <input name="odometer" required inputMode="numeric" autoComplete="off" className={inputClasses()} />
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm text-gray-500">Does the VIN on the title match the car?</legend>
        <label className="flex h-11 items-center gap-3 text-black">
          <input type="radio" name="title_matches" value="yes" required className="h-5 w-5" /> Yes
        </label>
        <label className="flex h-11 items-center gap-3 text-black">
          <input type="radio" name="title_matches" value="no" className="h-5 w-5" /> No
        </label>
      </fieldset>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-500">Anything ShipMova should know (damage, mismatches)</span>
        <textarea name="notes" rows={3} maxLength={2000} className={inputClasses()} />
      </label>
      {!ready ? <p className="text-sm text-copper-700">Take the VIN plate, odometer and title photos first.</p> : null}
      <Submit disabled={!ready} />
    </ActionForm>
  );
}
