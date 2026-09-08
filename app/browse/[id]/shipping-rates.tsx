"use client";

import { type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { selectShippingRate } from "./shipping-actions";

export interface PublicRate {
  rate_id: string;
  shipper_id: string;
  company_name: string;
  origin_region: string;
  origin_port: string | null;
  destination_country: string;
  vehicle_size_type: string | null;
  price: number;
  currency: string;
  payment_status: "good_standing" | "past_due" | "suspended";
}

export interface SelectedShipper {
  shipper_id: string;
  shipper_company_name: string | null;
  shipper_contact_name: string | null;
  shipper_contact_email: string | null;
  shipper_contact_phone: string | null;
  agreed_rate: number;
  currency: string;
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

export function ShippingRates({
  vehicleId,
  destinationLabel,
  rates,
  selected,
}: {
  vehicleId: string;
  destinationLabel: string;
  rates: PublicRate[];
  selected: SelectedShipper[];
}) {
  const selectedIds = new Set(selected.map((s) => s.shipper_id));
  const openRates = rates.filter((r) => !selectedIds.has(r.shipper_id));

  return (
    <section className="mt-10 rounded-lg border border-paper-200 bg-paper-100 p-6">
      <h2 className="text-ink-900">Arrange shipping to {destinationLabel}</h2>
      <p className="mt-1 text-sm text-slate-500">
        Rates are set by each shipper and shown exactly as listed — MOVA
        doesn&rsquo;t mark them up. Pick a shipper to unlock their contact
        details and arrange the shipment directly.
      </p>

      {selected.length > 0 ? (
        <div className="mt-4 flex flex-col gap-3">
          {selected.map((s) => (
            <div
              key={s.shipper_id}
              className="rounded border border-verified-100 bg-verified-50 p-4"
            >
              <p className="text-sm font-semibold text-ink-900">
                {s.shipper_company_name ?? "Shipper"} — contact unlocked
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                {s.shipper_contact_name ? (
                  <div>
                    <dt className="font-mono text-xs uppercase tracking-wider text-ink-400">
                      Contact
                    </dt>
                    <dd className="text-ink-900">{s.shipper_contact_name}</dd>
                  </div>
                ) : null}
                {s.shipper_contact_email ? (
                  <div>
                    <dt className="font-mono text-xs uppercase tracking-wider text-ink-400">
                      Email
                    </dt>
                    <dd className="text-ink-900">{s.shipper_contact_email}</dd>
                  </div>
                ) : null}
                {s.shipper_contact_phone ? (
                  <div>
                    <dt className="font-mono text-xs uppercase tracking-wider text-ink-400">
                      Phone
                    </dt>
                    <dd className="text-ink-900">{s.shipper_contact_phone}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="font-mono text-xs uppercase tracking-wider text-ink-400">
                    Agreed rate
                  </dt>
                  <dd className="font-semibold text-ink-900">
                    {money(Number(s.agreed_rate), s.currency)}
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      ) : null}

      {openRates.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          {rates.length === 0
            ? `No shippers are listing rates to ${destinationLabel} yet.`
            : "You've selected every shipper serving this route."}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {openRates.map((r) => (
            <li
              key={r.rate_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded border border-paper-200 p-4"
            >
              <div>
                <p className="font-semibold text-ink-900">
                  <a
                    href={`/shipper/${r.shipper_id}`}
                    className="hover:underline"
                  >
                    {r.company_name}
                  </a>
                  {r.payment_status !== "good_standing" ? (
                    <span className="ml-2 align-middle text-xs font-normal text-ink-400">
                      limited availability
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 font-mono text-sm text-ink-400">
                  {r.origin_region}
                  {r.origin_port ? ` (${r.origin_port})` : ""}
                  {r.vehicle_size_type ? ` · ${r.vehicle_size_type}` : ""} ·{" "}
                  <strong className="text-ink-900">
                    {money(Number(r.price), r.currency)}
                  </strong>
                </p>
              </div>
              <form action={selectShippingRate}>
                <input type="hidden" name="rateId" value={r.rate_id} />
                <input type="hidden" name="vehicleId" value={vehicleId} />
                <PendingButton
                  variant="secondary"
                  size="sm"
                  pendingLabel="Selecting…"
                >
                  Select this shipper
                </PendingButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
