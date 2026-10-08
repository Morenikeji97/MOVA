"use client";

import { ActionForm, useActionPending } from "@/components/ui/action-form";

import { Button } from "@/components/ui/button";
import { addShipmentNote } from "../actions";
import { inputClasses } from "@/components/ui/input-classes";

function SubmitButton() {
  const pending = useActionPending();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Posting…" : "Post update"}
    </Button>
  );
}

export function NoteForm({ shipmentId }: { shipmentId: string }) {
  return (
    <ActionForm action={addShipmentNote} resetOnSaved className="flex flex-col gap-2">
      <input type="hidden" name="shipmentId" value={shipmentId} />
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">
          Post an update the buyer will see
        </span>
        <textarea
          name="note"
          required
          rows={3}
          placeholder="e.g. Picked up from the seller, on the way to the port."
          className={inputClasses({ multiline: true })}
        />
      </label>
      <div>
        <SubmitButton />
      </div>
    </ActionForm>
  );
}
