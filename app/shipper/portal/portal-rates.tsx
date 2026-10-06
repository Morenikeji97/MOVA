"use client";

import { ActionForm, useActionPending } from "@/components/ui/action-form";

import { type ComponentProps, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  SERVICE_COUNTRIES,
  VEHICLE_SIZE_TYPES,
  SHIPPING_METHODS,
  countryName,
  vehicleSizeLabel,
  shippingMethodLabel,
} from "@/lib/shipping";
import type { ShippingMethod, VehicleSizeType } from "@/types/database";
import {
  addShipperRate,
  deleteShipperRate,
  setShipperRateActive,
  updateShipperRate,
} from "../actions";
import { inputClasses } from "@/components/ui/input-classes";

const inputClass = inputClasses();

export interface ShipperRate {
  id: string;
  origin_region: string;
  origin_port: string | null;
  destination_country: string;
  vehicle_size_type: VehicleSizeType;
  shipping_method: ShippingMethod;
  price: number;
  currency: string;
  active: boolean;
  /** Inland part of the price (pickup to port), paid at pickup; the rest is ocean freight. */
  inland_price: number | null;
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
  const pending = useActionPending();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

/** Shared origin/destination/price fields, optionally pre-filled for editing. */
function RateFields({ rate }: { rate?: ShipperRate }) {
  return (
    <>
      <input
        name="origin_region"
        required
        defaultValue={rate?.origin_region ?? ""}
        placeholder="Origin region (e.g. US East Coast)"
        className={inputClass}
      />
      <input
        name="origin_port"
        defaultValue={rate?.origin_port ?? ""}
        placeholder="Origin port (optional)"
        className={inputClass}
      />
      <select
        name="destination_country"
        required
        defaultValue={rate?.destination_country ?? ""}
        className={inputClass}
      >
        <option value="" disabled>
          Destination country…
        </option>
        {SERVICE_COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        name="vehicle_size_type"
        required
        defaultValue={rate?.vehicle_size_type ?? ""}
        className={inputClass}
      >
        <option value="" disabled>
          Vehicle size class…
        </option>
        {VEHICLE_SIZE_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <select
        name="shipping_method"
        required
        defaultValue={rate?.shipping_method ?? ""}
        className={inputClass}
      >
        <option value="" disabled>
          Shipping method…
        </option>
        {SHIPPING_METHODS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <input
        name="price"
        type="number"
        min={0}
        step="0.01"
        required
        defaultValue={rate ? String(rate.price) : ""}
        placeholder="Price"
        className={inputClass}
      />
      <input
        name="inland_price"
        type="number"
        min={0}
        step="0.01"
        inputMode="decimal"
        defaultValue={rate?.inland_price != null ? String(rate.inland_price) : ""}
        placeholder="Inland part (pickup to port)"
        aria-label="Inland part of the price, pickup to port — paid to you at pickup; the rest is paid at bill of lading"
        className={inputClass}
      />
      <input
        name="currency"
        defaultValue={rate?.currency ?? "USD"}
        maxLength={3}
        className={inputClass}
      />
    </>
  );
}

export function AddRateForm() {
  return (
    <ActionForm
      action={addShipperRate}
      resetOnSaved
      className="mt-4 grid grid-cols-1 gap-2 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2"
    >
      <p className="font-mono text-xs uppercase tracking-wider text-gray-500 sm:col-span-2">
        Add a rate — buyers see the price exactly as entered
      </p>
      <RateFields />
      <div className="sm:col-span-2">
        <PendingButton variant="secondary" size="sm" pendingLabel="Adding…">
          Add rate
        </PendingButton>
      </div>
    </ActionForm>
  );
}

function RateRow({ rate }: { rate: ShipperRate }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="rounded-lg border border-black bg-white p-4">
        <ActionForm
          action={updateShipperRate}
          onSaved={() => setEditing(false)}
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          <input type="hidden" name="id" value={rate.id} />
          <RateFields rate={rate} />
          <div className="flex items-center gap-3 sm:col-span-2">
            <PendingButton variant="primary" size="sm" pendingLabel="Saving…">
              Save
            </PendingButton>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-sm text-gray-500 hover:text-black"
            >
              Cancel
            </button>
          </div>
        </ActionForm>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <div>
        <p className="text-black">
          {rate.origin_region}
          {rate.origin_port ? ` (${rate.origin_port})` : ""} &rarr;{" "}
          {countryName(rate.destination_country)}
          {" · "}
          {vehicleSizeLabel(rate.vehicle_size_type)}
          {" · "}
          {shippingMethodLabel(rate.shipping_method)} ·{" "}
          <strong>{money(Number(rate.price), rate.currency)}</strong>
          {rate.inland_price != null ? (
            <span className="text-gray-500">
              {" "}(inland {money(Number(rate.inland_price), rate.currency)} at pickup + ocean{" "}
              {money(Number(rate.price) - Number(rate.inland_price), rate.currency)} at bill of lading)
            </span>
          ) : (
            <span className="text-copper-700"> · add the inland part so buyers can pay through escrow</span>
          )}
          {!rate.active ? (
            <span className="ml-2 text-xs font-normal text-copper-700">
              hidden from buyers
            </span>
          ) : null}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditing(true)}
        >
          Edit
        </Button>
        <ActionForm action={setShipperRateActive}>
          <input type="hidden" name="id" value={rate.id} />
          <input
            type="hidden"
            name="active"
            value={rate.active ? "false" : "true"}
          />
          <PendingButton
            variant="ghost"
            size="sm"
            pendingLabel="Updating…"
          >
            {rate.active ? "Hide" : "Show"}
          </PendingButton>
        </ActionForm>
        <ActionForm action={deleteShipperRate}>
          <input type="hidden" name="id" value={rate.id} />
          <PendingButton variant="ghost" size="sm" pendingLabel="Removing…">
            Delete
          </PendingButton>
        </ActionForm>
      </div>
    </li>
  );
}

export function RateList({ rates }: { rates: ShipperRate[] }) {
  if (rates.length === 0) {
    return (
      <p className="mt-4 rounded-lg border border-dashed border-gray-200 bg-white p-6 text-sm text-gray-500">
        No rates yet. Add one below — buyers shipping to a country you serve will
        see it at reservation time.
      </p>
    );
  }
  return (
    <ul className="mt-4 flex flex-col gap-2">
      {rates.map((r) => (
        <RateRow key={r.id} rate={r} />
      ))}
    </ul>
  );
}
