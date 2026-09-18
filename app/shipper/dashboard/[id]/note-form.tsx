"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { addShipmentNote } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Posting…" : "Post update"}
    </Button>
  );
}

export function NoteForm({ shipmentId }: { shipmentId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await addShipmentNote(formData);
        formRef.current?.reset();
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="shipmentId" value={shipmentId} />
      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-500">
          Post an update the buyer will see
        </span>
        <textarea
          name="note"
          required
          rows={3}
          placeholder="e.g. Picked up from the seller, on the way to the port."
          className="rounded border border-gray-200 px-3 py-2 text-sm"
        />
      </label>
      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
