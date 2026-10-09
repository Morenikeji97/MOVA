"use client";

import { useEffect, useState } from "react";
import { inputClasses } from "@/components/ui/input-classes";
import { cn } from "@/lib/utils";
import { formatCheckedDate, importStatus } from "@/lib/import-rules";
import { landedEstimate, type LandedCostRates, type LandedCountry } from "@/lib/landed-cost";
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
  landed,
  className,
}: {
  profileCountry: string | null;
  /** From lib/import-rules.ts modelYearFrom — for the per-country import line. */
  modelYear: number | null;
  /** For the delivered-cost estimate (lib/landed-cost.ts); omitted = shipping only. */
  landed?: {
    vehiclePrice: number;
    /** Car + ShipMova fee + Escrow.com fee — what's paid on ShipMova before shipping. */
    totalBeforeShipping: number;
    rates: Record<LandedCountry, LandedCostRates>;
  };
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
      className={cn("rounded-lg bg-band p-4 text-sm", className)}
    >
      <p className="font-semibold text-ink">
        Shipping to West Africa: from ~{usd.format(LOWEST_FREIGHT)} port-to-port, plus
        pickup to the US port — choose your country for an estimate
      </p>
      <label className="mt-3 flex flex-col gap-1 text-muted">
        Your country
        <select
          value={country ?? ""}
          onChange={(e) => {
            const next = e.target.value;
            if (!isEstimateCountry(next)) return;
            setCountry(next);
            saveLastChoice(next);
          }}
          className={inputClasses({ className: "w-full" })}
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
          <p className="mt-3 text-sm text-ink">
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
          <p className="mt-3 text-xs text-muted">
            Larger SUVs and trucks cost toward the top of the range. Estimate from
            published 2026 rates — you&rsquo;ll get a firm quote from your shipper after
            you reserve.
          </p>
          {landed ? (
            ["too_old", "not_allowed"].includes(importStatus(estimate.code, modelYear).kind) ? (
              // No delivered cost for a car that can't be imported there.
              <p className="mt-4 border-t border-line pt-4 text-sm text-muted">
                No delivered-cost estimate for {estimate.name}: this car can&rsquo;t be imported there (see above).
              </p>
            ) : (
              <Delivered estimate={estimate} landed={landed} />
            )
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-muted">
      <dt>{label}</dt>
      <dd className="shrink-0 tabular-nums text-ink">{value}</dd>
    </div>
  );
}

/**
 * Estimated delivered cost at the port: ShipMova total + shipping + duties
 * and taxes + fixed fees + port & clearing, each country's figures with
 * their source and last-checked date.
 */
function Delivered({
  estimate,
  landed,
}: {
  estimate: ReturnType<typeof shippingEstimateFor>;
  landed: NonNullable<Parameters<typeof ShippingEstimate>[0]["landed"]>;
}) {
  const rates = landed.rates[estimate.code];
  const e = landedEstimate({
    vehiclePrice: landed.vehiclePrice,
    totalBeforeShipping: landed.totalBeforeShipping,
    freight: estimate.freight,
    usPickup: US_PICKUP_TO_PORT,
    exportPaperwork: EXPORT_PAPERWORK,
    trackingFee: estimate.trackingNote?.fee ?? 0,
    rates,
  });
  return (
    <div className="mt-4 border-t border-line pt-4">
      <p className="font-semibold text-ink">Estimated delivered cost at {estimate.port}</p>
      <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-ink">{range(e.landed)}</p>
      <dl className="mt-3 flex flex-col gap-1">
        <Line label="On ShipMova (car, fee, Escrow.com fee)" value={usd.format(landed.totalBeforeShipping)} />
        <Line label="Shipping to the port (all of the above)" value={range(e.shipping)} />
        <Line
          label={`Import duties & taxes (${pct(rates.dutiesPct.min)}–${pct(rates.dutiesPct.max)} of CIF)`}
          value={range(e.duties)}
        />
        {e.fixedFees > 0 ? <Line label="Fixed customs fees" value={usd.format(e.fixedFees)} /> : null}
        {e.portClearing ? (
          <Line label={`Port & clearing at ${estimate.port}`} value={range(e.portClearing)} />
        ) : (
          <div className="flex items-baseline justify-between gap-4 text-muted">
            <dt>Port &amp; clearing at {estimate.port}</dt>
            <dd className="shrink-0 text-right">not included</dd>
          </div>
        )}
      </dl>
      <p className="mt-3 text-xs text-muted">
        An estimate, not a quote: customs value the car at their own reference price, not what you pay.
        ShipMova doesn&rsquo;t clear customs.
      </p>
      <p className="mt-1 text-xs text-muted">
        Source:{" "}
        {rates.sourceUrl ? (
          <a href={rates.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {rates.sourceNote}
          </a>
        ) : (
          rates.sourceNote
        )}{" "}
        · last checked {formatCheckedDate(rates.lastCheckedOn)} · confirm with your clearing agent
      </p>
    </div>
  );
}

const pct = (n: number) => `${Math.round(n * 10) / 10}%`;
