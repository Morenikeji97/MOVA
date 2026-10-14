"use client";

import { ActionForm, useActionPending } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input-classes";
import type { LandedCountry } from "@/lib/landed-cost";
import { updateLandedCostRates } from "./actions";

function Save() {
  const pending = useActionPending();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Saving…" : "Save and mark checked today"}
    </Button>
  );
}

function Field({
  name,
  label,
  defaultValue,
  suffix,
}: {
  name: string;
  label: string;
  defaultValue: string;
  suffix: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-muted">
      {label}
      <span className="flex items-center gap-2">
        <input
          name={name}
          defaultValue={defaultValue}
          inputMode="decimal"
          autoComplete="off"
          className={inputClasses({ className: "w-full" })}
        />
        <span className="w-6 shrink-0 text-ink">{suffix}</span>
      </span>
    </label>
  );
}

/** One country's rates. Percents as typed ("40" = 40%); port & clearing blank = not included. */
export function LandedRatesForm({
  country,
  values,
}: {
  country: LandedCountry;
  values: {
    duties_min_pct: string;
    duties_max_pct: string;
    insurance_pct: string;
    fixed_fees_usd: string;
    port_clearing_min_usd: string;
    port_clearing_max_usd: string;
    source_note: string;
    source_url: string;
  };
}) {
  return (
    <ActionForm action={updateLandedCostRates} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="country" value={country} />
      <div className="grid grid-cols-2 gap-3">
        <Field name="duties_min_pct" label="Duties & taxes, low" defaultValue={values.duties_min_pct} suffix="%" />
        <Field name="duties_max_pct" label="Duties & taxes, high" defaultValue={values.duties_max_pct} suffix="%" />
        <Field name="port_clearing_min_usd" label="Port & clearing, low" defaultValue={values.port_clearing_min_usd} suffix="$" />
        <Field name="port_clearing_max_usd" label="Port & clearing, high" defaultValue={values.port_clearing_max_usd} suffix="$" />
        <Field name="fixed_fees_usd" label="Fixed customs fees" defaultValue={values.fixed_fees_usd} suffix="$" />
        <Field name="insurance_pct" label="Insurance (of car price)" defaultValue={values.insurance_pct} suffix="%" />
      </div>
      <p className="text-xs text-muted">Leave both port &amp; clearing boxes blank if there&rsquo;s no source: buyers then see &ldquo;not included&rdquo;.</p>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Where these figures come from (shown to buyers)
        <textarea name="source_note" required rows={4} maxLength={2000} defaultValue={values.source_note} className={inputClasses({ multiline: true })} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Source link (optional)
        <input name="source_url" type="url" inputMode="url" autoComplete="off" defaultValue={values.source_url} className={inputClasses()} />
      </label>
      <Save />
    </ActionForm>
  );
}
