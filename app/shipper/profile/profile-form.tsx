"use client";

import { ActionForm, useActionPending } from "@/components/ui/action-form";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SERVICE_COUNTRIES } from "@/lib/shipping";
import { US_STATES } from "@/lib/us-states";
import { updateShipperProfile } from "./actions";
import { inputClasses } from "@/components/ui/input-classes";

function SubmitButton() {
  const pending = useActionPending();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

export function ShipperProfileForm({
  companyName,
  description,
  serviceCountries,
  serviceAreas,
}: {
  companyName: string;
  description: string;
  serviceCountries: string[];
  serviceAreas: string[];
}) {
  const [selected, setSelected] = useState(new Set(serviceCountries));
  const [selectedAreas, setSelectedAreas] = useState(new Set(serviceAreas));

  return (
    <ActionForm action={updateShipperProfile} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">Company name</span>
        <input
          type="text"
          name="companyName"
          required
          defaultValue={companyName}
          autoComplete="organization"
          className={inputClasses()}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">
          Description <span className="text-muted">(shown on your public profile)</span>
        </span>
        <textarea
          name="description"
          rows={4}
          defaultValue={description}
          placeholder="A short description of your service — years in business, typical transit time, what makes you reliable."
          className={inputClasses({ multiline: true })}
        />
      </label>

      <fieldset>
        <legend className="text-sm text-muted">Countries you ship to</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SERVICE_COUNTRIES.map((c) => {
            const checked = selected.has(c.code);
            return (
              <label
                key={c.code}
                className={`flex h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-semibold ${
                  checked
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-white text-ink"
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

      <fieldset>
        <legend className="text-sm text-muted">
          US states you pick up vehicles from
        </legend>
        <p className="mt-1 text-xs text-muted">
          Buyers see you flagged as a local, likely-cheaper pickup option for
          vehicles located in these states.
        </p>
        <div className="mt-2 grid max-h-72 grid-cols-2 gap-x-3 overflow-y-auto rounded-lg border border-line p-3 sm:grid-cols-3">
          {US_STATES.map(([code, name]) => {
            const checked = selectedAreas.has(code);
            return (
              <label key={code} className="flex h-11 items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  name="serviceAreas"
                  value={code}
                  checked={checked}
                  onChange={(e) => {
                    const next = new Set(selectedAreas);
                    if (e.target.checked) next.add(code);
                    else next.delete(code);
                    setSelectedAreas(next);
                  }}
                  className="h-5 w-5 shrink-0 accent-ink"
                />
                {name}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div>
        <SubmitButton />
      </div>
    </ActionForm>
  );
}
