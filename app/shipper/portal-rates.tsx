"use client";

import { type ComponentProps, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { SERVICE_COUNTRIES, countryName } from "@/lib/shipping";
import {
  addShipperRate,
  deleteShipperRate,
  setShipperRateActive,
  updateShipperRate,
} from "./actions";

const inputClass =
  "h-10 rounded border border-paper-200 bg-paper-100 px-3 text-sm text-ink-900";

export interface ShipperRate {
  id: string;
  origin_region: string;
  origin_port: string | null;
  destination_country: string;
  vehicle_size_type: string | null;
  price: number;
  currency: string;
  active: boolean;
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
      <input
        name="vehicle_size_type"
        defaultValue={rate?.vehicle_size_type ?? ""}
        placeholder="Vehicle size / type (optional)"
        className={inputClass}
      />
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
    <form
      action={addShipperRate}
      className="mt-4 grid grid-cols-1 gap-2 rounded-lg border border-paper-200 bg-paper-100 p-4 sm:grid-cols-2"
    >
      <p className="font-mono text-xs uppercase tracking-wider text-ink-400 sm:col-span-2">
        Add a rate — buyers see the price exactly as entered
      </p>
      <RateFields />
      <div className="sm:col-span-2">
        <PendingButton variant="secondary" size="sm" pendingLabel="Adding…">
          Add rate
        </PendingButton>
      </div>
    </form>
  );
}

function RateRow({ rate }: { rate: ShipperRate }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="rounded-lg border border-marine bg-paper-100 p-4">
        <form
          action={updateShipperRate}
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
              className="text-sm text-slate-500 hover:text-ink-900"
            >
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-paper-200 bg-paper-100 p-4">
      <div>
        <p className="text-ink-900">
          {rate.origin_region}
          {rate.origin_port ? ` (${rate.origin_port})` : ""} &rarr;{" "}
          {countryName(rate.destination_country)}
          {rate.vehicle_size_type ? ` · ${rate.vehicle_size_type}` : ""} ·{" "}
          <strong>{money(Number(rate.price), rate.currency)}</strong>
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
        <form action={setShipperRateActive}>
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
        </form>
        <form action={deleteShipperRate}>
          <input type="hidden" name="id" value={rate.id} />
          <PendingButton variant="ghost" size="sm" pendingLabel="Removing…">
            Delete
          </PendingButton>
        </form>
      </div>
    </li>
  );
}

export function RateList({ rates }: { rates: ShipperRate[] }) {
  if (rates.length === 0) {
    return (
      <p className="mt-4 rounded-lg border border-dashed border-paper-200 bg-paper-100 p-6 text-sm text-slate-500">
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
