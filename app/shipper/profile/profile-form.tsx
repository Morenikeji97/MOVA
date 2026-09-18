"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { SERVICE_COUNTRIES } from "@/lib/shipping";
import { updateShipperProfile } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

export function ShipperProfileForm({
  companyName,
  description,
  serviceCountries,
}: {
  companyName: string;
  description: string;
  serviceCountries: string[];
}) {
  const [selected, setSelected] = useState(new Set(serviceCountries));
  const [saved, setSaved] = useState(false);

  return (
    <form
      action={async (formData) => {
        await updateShipperProfile(formData);
        setSaved(true);
      }}
      onChange={() => setSaved(false)}
      className="flex flex-col gap-4"
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-500">Company name</span>
        <input
          type="text"
          name="companyName"
          required
          defaultValue={companyName}
          className="h-11 rounded border border-gray-200 px-3"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-500">
          Description <span className="text-gray-500">(shown on your public profile)</span>
        </span>
        <textarea
          name="description"
          rows={4}
          defaultValue={description}
          placeholder="A short description of your service — years in business, typical transit time, what makes you reliable."
          className="rounded border border-gray-200 px-3 py-2 text-sm"
        />
      </label>

      <fieldset>
        <legend className="text-sm text-gray-500">Countries you ship to</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SERVICE_COUNTRIES.map((c) => {
            const checked = selected.has(c.code);
            return (
              <label
                key={c.code}
                className={`flex h-11 cursor-pointer items-center gap-2 rounded border px-4 text-sm font-medium ${
                  checked
                    ? "border-black bg-gray-100 text-black"
                    : "border-gray-200 text-gray-500"
                }`}
              >
                <input
                  type="checkbox"
                  name="serviceCountries"
                  value={c.code}
                  checked={checked}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(c.code);
                    else next.delete(c.code);
                    setSelected(next);
                  }}
                  className="sr-only"
                />
                {c.name}
              </label>
            );
          })}
        </div>
      </fieldset>

      {saved ? (
        <p className="text-sm text-verified-600">Saved.</p>
      ) : null}
      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
