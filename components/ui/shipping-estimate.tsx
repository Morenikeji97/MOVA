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
import { feeBreakdown } from "@/lib/fees";
import {
  DEFAULT_ENGINE_SIZE,
  ENGINE_SIZES,
  nigeriaLandedEstimate,
  type EngineSize,
  type NigeriaRates,
} from "@/lib/landed-cost";
import type { FeeResponsibility } from "@/types/database";

const STORAGE_KEY = "mova:shipping-estimate-country";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
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
  price,
  feeResponsibility,
  ngRates,
  ngRatesCheckedAt,
  className,
}: {
  profileCountry: string | null;
  /** Car price and fee split — for the Nigeria landed-cost estimate. */
  price: number;
  feeResponsibility: FeeResponsibility;
  /** Live rates from the import_rates table (lib/import-rates.ts). */
  ngRates: NigeriaRates;
  /** When staff last confirmed them; null when using the built-in defaults. */
  ngRatesCheckedAt: string | null;
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
          className="h-11 max-w-xs rounded border border-gray-200 bg-white px-3 text-base text-black"
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
          {estimate.code === "NG" ? (
            <NigeriaLandedCost
              price={price}
              feeResponsibility={feeResponsibility}
              rates={ngRates}
              checkedAt={ngRatesCheckedAt}
            />
          ) : (
            <p className="mt-3 text-xs text-gray-500">
              Import duty and clearing for {estimate.name} aren&rsquo;t estimated yet — ask
              your clearing agent.
            </p>
          )}
        </>
      ) : null}
    </section>
  );
}

/**
 * Estimated Nigerian Customs charges, port/clearing and the all-in landed
 * cost in Lagos, from lib/landed-cost.ts. Ranges follow the freight and
 * pickup ranges above.
 */
function NigeriaLandedCost({
  price,
  feeResponsibility,
  rates,
  checkedAt,
}: {
  price: number;
  feeResponsibility: FeeResponsibility;
  rates: NigeriaRates;
  checkedAt: string | null;
}) {
  const [engine, setEngine] = useState<EngineSize>(DEFAULT_ENGINE_SIZE);
  const fees = feeBreakdown(price, feeResponsibility);
  const e = nigeriaLandedEstimate({
    vehiclePrice: fees.vehiclePrice,
    totalBeforeShipping: fees.totalBeforeShipping,
    freight: shippingEstimateFor("NG").freight,
    usPickup: US_PICKUP_TO_PORT,
    exportPaperwork: EXPORT_PAPERWORK,
    engine,
    rates,
  });
  const pct = (f: number) => `${Math.round(f * 1000) / 10}%`;
  const rng = (lo: number, hi: number) =>
    lo === hi ? usd.format(lo) : range({ min: lo, max: hi });

  return (
    <div className="mt-4 border-t border-gray-200 pt-4">
      <p className="font-semibold text-black">Nigerian import charges (estimate)</p>
      <label className="mt-3 flex flex-col gap-1 text-gray-500">
        Engine size
        <select
          value={engine}
          onChange={(ev) => setEngine(ev.target.value as EngineSize)}
          className="h-11 max-w-xs rounded border border-gray-200 bg-white px-3 text-base text-black"
        >
          {ENGINE_SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <dl className="mt-3 flex flex-col gap-1">
        <Line label={`Import duty (${pct(rates.importDuty)})`} value={rng(e.low.importDuty, e.high.importDuty)} />
        <Line label={`NAC levy (${pct(rates.nacLevy)})`} value={rng(e.low.nacLevy, e.high.nacLevy)} />
        {e.high.greenTax > 0 ? (
          <Line label="Green tax (engine size)" value={rng(e.low.greenTax, e.high.greenTax)} />
        ) : null}
        <Line label={`Surcharge (${pct(rates.surchargeOfDuty)} of duty)`} value={rng(e.low.surcharge, e.high.surcharge)} />
        <Line label={`ETLS levy (${pct(rates.etls)})`} value={rng(e.low.etls, e.high.etls)} />
        <Line label={`Customs FOB charge (${pct(rates.fobCharge)})`} value={rng(e.low.fobCharge, e.high.fobCharge)} />
        <Line label={`VAT (${pct(rates.vat)})`} value={rng(e.low.vat, e.high.vat)} />
        <Line label="Port & clearing agent (Lagos)" value={range(e.portAndClearing)} />
      </dl>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-gray-200 pt-2 font-semibold text-black">
        <span>Estimated landed in Lagos</span>
        <span className="font-mono">{range(e.landed)}</span>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Car price, ShipMova and escrow fees, shipping, customs and clearing.
      </p>
      <p className="mt-3 text-xs text-gray-500">
        {checkedAt
          ? `Rates last checked ${dateFmt.format(new Date(checkedAt))}. `
          : "Based on 2026 published rates. "}
        Nigeria Customs values the car itself, so the real duty can differ — confirm
        with your clearing agent. ShipMova doesn&rsquo;t collect or pay customs charges.
      </p>
    </div>
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
