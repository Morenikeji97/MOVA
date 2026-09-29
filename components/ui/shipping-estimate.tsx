"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { importStatus } from "@/lib/import-rules";
import {
  EXPORT_PAPERWORK,
  initialEstimateCountry,
  isEstimateCountry,
  LOWEST_FREIGHT,
  shippingEstimateFor,
  SHIPPING_ESTIMATES,
  US_PICKUP_TO_PORT,
  type EstimateCountry,
  type Range,
} from "@/lib/shipping-estimates";

const STORAGE_KEY = "mova:shipping-estimate-country";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const range = (r: Range) => `${usd.format(r.min)}–${usd.format(r.max)}`;

function readLastChoice(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveLastChoice(code: EstimateCountry) {
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Private mode / blocked storage: the picker still works, it just won't be remembered.
  }
}

/**
 * Shipping estimate under the price on a listing page — published ranges
 * from lib/shipping-estimates.ts, not a quote, and never added to "Total
 * before shipping".
 *
 * Opens on a signed-in buyer's profile country, otherwise the browser's last
 * choice (localStorage), otherwise nothing selected.
 */
export function ShippingEstimate({
  profileCountry,
  modelYear,
  className,
}: {
  profileCountry: string | null;
  /** From lib/import-rules.ts modelYearFrom — for the per-country import line. */
  modelYear: number | null;
  className?: string;
}) {
  const [country, setCountry] = useState<EstimateCountry | null>(() =>
    initialEstimateCountry(profileCountry, null),
  );

  // The browser's last choice can only be read after hydration; the
  // profile country, when there is one, still wins.
  useEffect(() => {
    if (isEstimateCountry(profileCountry)) return;
    const saved = initialEstimateCountry(null, readLastChoice());
    if (saved) setCountry(saved);
  }, [profileCountry]);

  const estimate = country ? shippingEstimateFor(country) : null;

  return (
    <section
      aria-label="Shipping estimate"
      className={cn("rounded-lg border border-gray-200 bg-white p-4 text-sm", className)}
    >
      <p className="text-black">
        Shipping to West Africa: from ~{usd.format(LOWEST_FREIGHT)} port-to-port, plus
        pickup to the US port — choose your country for an estimate
      </p>
      <label className="mt-3 flex flex-col gap-1 text-gray-500">
        Your country
        <select
          value={country ?? ""}
          onChange={(e) => {
            const next = e.target.value;
            if (!isEstimateCountry(next)) return;
            setCountry(next);
            saveLastChoice(next);
          }}
          className="h-10 max-w-xs rounded border border-gray-200 bg-white px-3 text-black"
        >
          <option value="" disabled>
            Choose your country
          </option>
          {SHIPPING_ESTIMATES.map((e) => (
            <option key={e.code} value={e.code}>
              {e.name}
            </option>
          ))}
        </select>
      </label>

      {estimate ? (
        <>
          <p className="mt-3 text-sm text-black">
            {importStatus(estimate.code, modelYear).label}
          </p>
          <dl className="mt-3 flex flex-col gap-1">
            <Line
              label={`Freight to ${estimate.port} (port-to-port)`}
              value={range(estimate.freight)}
            />
            {estimate.trackingNote ? (
              <Line
                label={`${estimate.trackingNote.label} (required for ${estimate.name})`}
                value={usd.format(estimate.trackingNote.fee)}
              />
            ) : null}
            <Line label="Pickup to the US port (depends on distance)" value={range(US_PICKUP_TO_PORT)} />
            <Line label="Export paperwork" value={range(EXPORT_PAPERWORK)} />
          </dl>
          <p className="mt-3 text-xs text-gray-500">
            Larger SUVs and trucks cost toward the top of the range. Estimate from
            published 2026 rates — you&rsquo;ll get a firm quote from your shipper after
            you reserve.
          </p>
        </>
      ) : null}
    </section>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-gray-500">
      <dt>{label}</dt>
      <dd className="shrink-0 font-mono text-black">{value}</dd>
    </div>
  );
}
