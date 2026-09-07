import { type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { countryName } from "@/lib/shipping";
import type { ShipperPaymentStatus } from "@/types/database";
import {
  AddRateForm,
  DeleteRateButton,
  ReinstateShipperButton,
  ShipperReviewActions,
} from "./shipper-admin";

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(amount);

const fmtDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const PAYMENT_STATUS_LABEL: Record<ShipperPaymentStatus, string> = {
  good_standing: "Good standing",
  past_due: "Past due",
  suspended: "Suspended",
};

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-xs uppercase tracking-wider text-ink-400">
        {label}
      </dt>
      <dd className="text-ink-900">{children}</dd>
    </div>
  );
}

type ShipperRow = {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  fmc_oti_license_number: string;
  service_countries: string[];
  status: string;
  payment_status: ShipperPaymentStatus;
  terms_accepted_at: string | null;
  card_on_file: boolean;
  rejection_reason: string | null;
  created_at: string;
};

type RateRow = {
  id: string;
  shipper_id: string;
  origin_region: string;
  origin_port: string | null;
  destination_country: string;
  vehicle_size_type: string | null;
  price: number;
  currency: string;
  active: boolean;
};

function ShipperFacts({ s }: { s: ShipperRow }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
      <Detail label="Contact">{s.contact_name}</Detail>
      <Detail label="Email">{s.contact_email}</Detail>
      {s.contact_phone ? <Detail label="Phone">{s.contact_phone}</Detail> : null}
      <Detail label="FMC OTI license">{s.fmc_oti_license_number}</Detail>
      <Detail label="Ships to">
        {s.service_countries.map(countryName).join(", ") || "—"}
      </Detail>
      <Detail label="Card on file">{s.card_on_file ? "Yes" : "No"}</Detail>
      <Detail label="Terms accepted">
        {s.terms_accepted_at
          ? fmtDate.format(new Date(s.terms_accepted_at))
          : "Not recorded"}
      </Detail>
      <Detail label="Applied">
        {fmtDate.format(new Date(s.created_at))}
      </Detail>
    </dl>
  );
}

export default async function AdminShippersPage() {
  const supabase = await createClient();

  const { data: shipperRows } = await supabase
    .from("shippers")
    .select(
      "id, company_name, contact_name, contact_email, contact_phone, fmc_oti_license_number, service_countries, status, payment_status, terms_accepted_at, card_on_file, rejection_reason, created_at",
    )
    .order("created_at", { ascending: true });

  const shippers = (shipperRows ?? []) as ShipperRow[];
  const pending = shippers.filter((s) => s.status === "pending");
  const approved = shippers.filter((s) => s.status === "approved");
  const suspended = approved.filter((s) => s.payment_status === "suspended");

  const approvedIds = approved.map((s) => s.id);
  const { data: rateRows } = approvedIds.length
    ? await supabase
        .from("shipping_rates")
        .select(
          "id, shipper_id, origin_region, origin_port, destination_country, vehicle_size_type, price, currency, active",
        )
        .in("shipper_id", approvedIds)
        .order("created_at", { ascending: true })
    : { data: [] as RateRow[] };

  const ratesByShipper = new Map<string, RateRow[]>();
  for (const r of (rateRows ?? []) as RateRow[]) {
    const list = ratesByShipper.get(r.shipper_id) ?? [];
    list.push(r);
    ratesByShipper.set(r.shipper_id, list);
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link
        href="/admin/dashboard"
        className="font-mono text-xs uppercase tracking-wider text-ink-400 hover:text-ink-900"
      >
        &larr; Admin dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-ink-900">
        Shipper review
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Approve applicants, manage their rates, and reinstate suspended shippers.
      </p>

      {/* Pending applications */}
      <section className="mt-8">
        <h2 className="font-mono text-xs uppercase tracking-wider text-ink-400">
          Pending applications ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nothing waiting for review.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-4">
            {pending.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-paper-200 bg-paper-100 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-lg font-semibold text-ink-900">
                    {s.company_name}
                  </h3>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-marine-50 px-2.5 py-1 text-sm font-medium text-marine-700">
                    Pending
                  </span>
                </div>
                <ShipperFacts s={s} />
                {!s.card_on_file ? (
                  <p className="mt-2 text-sm text-copper-700">
                    No card on file yet — the applicant hasn&rsquo;t finished
                    Stripe card setup. Commission can&rsquo;t be auto-collected
                    until they do.
                  </p>
                ) : null}
                <ShipperReviewActions shipperId={s.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Suspended */}
      {suspended.length > 0 ? (
        <section className="mt-12">
          <h2 className="font-mono text-xs uppercase tracking-wider text-ink-400">
            Suspended ({suspended.length})
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Hidden from buyer-facing results until reinstated.
          </p>
          <ul className="mt-3 flex flex-col gap-4">
            {suspended.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-copper-100 bg-copper-50 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-lg font-semibold text-ink-900">
                    {s.company_name}
                  </h3>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-copper-100 px-2.5 py-1 text-sm font-medium text-copper-700">
                    Suspended
                  </span>
                </div>
                <ShipperFacts s={s} />
                <div className="mt-4 border-t border-copper-100 pt-4">
                  <ReinstateShipperButton shipperId={s.id} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Approved + rate management */}
      <section className="mt-12">
        <h2 className="font-mono text-xs uppercase tracking-wider text-ink-400">
          Approved shippers ({approved.length})
        </h2>
        {approved.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">None yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-4">
            {approved.map((s) => {
              const rates = ratesByShipper.get(s.id) ?? [];
              return (
                <li
                  key={s.id}
                  className="rounded-lg border border-paper-200 bg-paper-100 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-lg font-semibold text-ink-900">
                      {s.company_name}
                    </h3>
                    <span className="inline-flex shrink-0 items-center rounded-full bg-verified-50 px-2.5 py-1 text-sm font-medium text-verified-600">
                      {PAYMENT_STATUS_LABEL[s.payment_status]}
                    </span>
                  </div>
                  <ShipperFacts s={s} />

                  <div className="mt-4 border-t border-paper-200 pt-4">
                    <p className="font-mono text-xs uppercase tracking-wider text-ink-400">
                      Rates ({rates.length}) — shown to buyers exactly as entered
                    </p>
                    {rates.length > 0 ? (
                      <ul className="mt-2 flex flex-col gap-2">
                        {rates.map((r) => (
                          <li
                            key={r.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded border border-paper-200 px-3 py-2 text-sm"
                          >
                            <span className="text-ink-900">
                              {r.origin_region}
                              {r.origin_port ? ` (${r.origin_port})` : ""} &rarr;{" "}
                              {countryName(r.destination_country)}
                              {r.vehicle_size_type
                                ? ` · ${r.vehicle_size_type}`
                                : ""}{" "}
                              · <strong>{money(Number(r.price), r.currency)}</strong>
                            </span>
                            <DeleteRateButton rateId={r.id} />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">
                        No rates yet — buyers won&rsquo;t see this shipper until
                        one is added.
                      </p>
                    )}
                    <AddRateForm shipperId={s.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

export const dynamic = "force-dynamic";
