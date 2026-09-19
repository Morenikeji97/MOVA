"use client";

import { type ComponentProps, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { SERVICE_COUNTRIES, countryName, shippingMethodLabel, isLocalPickup } from "@/lib/shipping";
import type { ShippingMethod, VehicleSizeType } from "@/types/database";
import { selectShippingRate } from "./shipping-actions";

export interface PublicRate {
  rate_id: string;
  shipper_id: string;
  company_name: string;
  service_areas: string[];
  origin_region: string;
  origin_port: string | null;
  destination_country: string;
  vehicle_size_type: VehicleSizeType;
  shipping_method: ShippingMethod;
  price: number;
  currency: string;
  payment_status: "good_standing" | "past_due" | "suspended";
}

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function PendingButton({
  children,
  pendingLabel,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

/**
 * Destination -> shipper/method comparison -> select, required before Invoice
 * 1 (enforced in requestFeePayment, not here — this is the buyer-facing side
 * of that same rule). Every rate already carries its own vehicle_size_type
 * (filtered server-side to this vehicle's) and shipping_method, so a shipper
 * offering both RoRo and container for the same destination just shows as
 * two separate, separately-selectable rows.
 */
export function ShippingRates({
  vehicleId,
  purchaseRequestId,
  defaultDestination,
  vehicleState,
  rates,
  selectedRateId,
  locked,
}: {
  vehicleId: string;
  purchaseRequestId: string;
  defaultDestination: string;
  vehicleState: string | null;
  rates: PublicRate[];
  selectedRateId: string | null;
  locked: boolean;
}) {
  const [destination, setDestination] = useState(defaultDestination);

  const selectedRate = selectedRateId ? rates.find((r) => r.rate_id === selectedRateId) : undefined;
  const visibleRates = rates.filter((r) => r.destination_country === destination);

  return (
    <section className="mt-10 rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-black">Shipping — required before your invoice</h2>
      <p className="mt-1 text-sm text-gray-500">
        Rates are set by each shipper and shown exactly as listed — MOVA
        doesn&rsquo;t mark them up. You need to pick one before MOVA can send
        your service-fee invoice.
      </p>

      {selectedRate ? (
        <div className="mt-4 rounded border border-verified-100 bg-verified-50 p-4">
          <p className="text-sm font-semibold text-black">
            Selected: {selectedRate.company_name} — {countryName(selectedRate.destination_country)},{" "}
            {shippingMethodLabel(selectedRate.shipping_method)} —{" "}
            {money(selectedRate.price, selectedRate.currency)}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {locked
              ? "Locked in — your invoice has been sent."
              : "To change shippers, contact MOVA support before your invoice is sent."}
          </p>
        </div>
      ) : (
        <p className="mt-4 rounded border border-copper-100 bg-copper-50 p-3 text-sm text-copper-700">
          Not selected yet — choose a destination and shipper below.
        </p>
      )}

      {!locked && !selectedRate ? (
        <>
          <label className="mt-4 flex flex-col gap-1">
            <span className="text-sm text-gray-500">Destination</span>
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="h-11 w-full max-w-xs rounded border border-gray-200 bg-white px-3 text-sm text-black sm:w-auto"
            >
              {SERVICE_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {visibleRates.length === 0 ? (
            <p className="mt-4 rounded border border-dashed border-gray-200 bg-white p-3 text-sm text-gray-500">
              No shippers are listing rates to {countryName(destination)} for
              this vehicle&rsquo;s size class yet. Try another destination, or
              check back soon.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {visibleRates.map((r) => (
                <li
                  key={r.rate_id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded border border-gray-200 p-4"
                >
                  <div>
                    <p className="font-semibold text-black">
                      <a href={`/shipper/${r.shipper_id}`} className="hover:underline">
                        {r.company_name}
                      </a>
                      {isLocalPickup(r.service_areas, vehicleState) ? (
                        <span className="ml-2 align-middle rounded bg-verified-50 px-2 py-0.5 text-xs font-normal text-verified-600">
                          Local pickup — lower rate likely
                        </span>
                      ) : null}
                      {r.payment_status !== "good_standing" ? (
                        <span className="ml-2 align-middle text-xs font-normal text-gray-500">
                          limited availability
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 font-mono text-sm text-gray-500">
                      {r.origin_region}
                      {r.origin_port ? ` (${r.origin_port})` : ""} ·{" "}
                      {shippingMethodLabel(r.shipping_method)} ·{" "}
                      <strong className="text-black">{money(r.price, r.currency)}</strong>
                    </p>
                  </div>
                  <form action={selectShippingRate}>
                    <input type="hidden" name="rateId" value={r.rate_id} />
                    <input type="hidden" name="vehicleId" value={vehicleId} />
                    <input type="hidden" name="purchaseRequestId" value={purchaseRequestId} />
                    <PendingButton variant="primary" size="sm" pendingLabel="Selecting…">
                      Select
                    </PendingButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </section>
  );
}
