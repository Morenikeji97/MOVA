import { type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SHIPPER_FEES_ENABLED, countryName, vehicleSizeLabel, shippingMethodLabel } from "@/lib/shipping";
import type { ShipperPaymentStatus, ShippingMethod, VehicleSizeType } from "@/types/database";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FMC_OTI_SEARCH_URLS,
  SHIPPER_INSURANCE_BUCKET,
  cleanFmcLicense,
  daysUntil,
  formatDay,
  isBookable,
  isoDay,
  type CoiStatus,
  type LicenseStatus,
} from "@/lib/shipper-verification";
import { CoiDecisionForm, LicenseCheckForm } from "./verification-forms";
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
      <dt className="font-mono text-xs uppercase tracking-wider text-gray-500">
        {label}
      </dt>
      <dd className="text-black">{children}</dd>
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
  terms_version: string | null;
  card_on_file: boolean;
  rejection_reason: string | null;
  created_at: string;
  coi_status: CoiStatus;
  coi_document_path: string | null;
  coi_insurer: string | null;
  coi_cargo_limit_usd: number | null;
  coi_expires_on: string | null;
  coi_reviewed_at: string | null;
  license_status: LicenseStatus;
  license_checked_at: string | null;
};

const COI_LABEL: Record<CoiStatus, string> = {
  none: "Not uploaded",
  pending: "Waiting for your check",
  approved: "Approved",
  rejected: "Rejected — waiting for a new one",
};

/** Insurance certificate + FMC license checks for one shipper (0060). */
function VerificationPanel({ s, coiLink, today }: { s: ShipperRow; coiLink: string | null; today: string }) {
  const days = s.coi_expires_on ? daysUntil(s.coi_expires_on, today) : null;
  const license = cleanFmcLicense(s.fmc_oti_license_number);
  return (
    <div className="mt-4 border-t border-gray-200 pt-4">
      <p className="font-mono text-xs uppercase tracking-wider text-gray-500">
        Verification · {isBookable(s, today) ? "shown to buyers" : "hidden from buyers"}
      </p>

      <div className="mt-3">
        <p className="text-sm font-medium text-black">Marine cargo insurance: {COI_LABEL[s.coi_status]}</p>
        {s.coi_status !== "none" ? (
          <p className="mt-1 text-sm text-gray-500">
            {s.coi_insurer ?? "—"}
            {s.coi_cargo_limit_usd != null ? ` · cover up to ${money(Number(s.coi_cargo_limit_usd), "USD")}` : ""}
            {s.coi_expires_on ? ` · expires ${formatDay(s.coi_expires_on)}` : ""}
            {days !== null && days < 0 ? " (EXPIRED)" : days !== null && days <= 30 ? ` (${days} days left)` : ""}
          </p>
        ) : null}
        {coiLink ? (
          <a
            href={coiLink}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex h-11 items-center text-sm text-black underline"
          >
            Open certificate (link works for 5 minutes)
          </a>
        ) : s.coi_document_path ? (
          <p className="mt-1 text-sm text-copper-700">The certificate file couldn&rsquo;t be loaded.</p>
        ) : null}
        {s.coi_status === "pending" ? <CoiDecisionForm shipperId={s.id} /> : null}
      </div>

      <div className="mt-5">
        <p className="text-sm font-medium text-black">
          FMC/OTI license {s.fmc_oti_license_number}:{" "}
          {s.license_status === "active"
            ? `active on FMC list (checked ${s.license_checked_at ? fmtDate.format(new Date(s.license_checked_at)) : ""})`
            : s.license_status === "not_found"
              ? "not found on FMC list"
              : "not checked yet"}
        </p>
        {!license ? (
          <p className="mt-1 text-sm text-copper-700">
            This doesn&rsquo;t look like an FMC license number (digits, sometimes ending in N, F or NF).
          </p>
        ) : null}
        <p className="mt-1 text-sm text-gray-500">
          Search {license ?? s.fmc_oti_license_number} on the FMC&rsquo;s OTI list:{" "}
          {FMC_OTI_SEARCH_URLS.map((u, i) => (
            <span key={u.href}>
              {i > 0 ? " · " : ""}
              <a href={u.href} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center underline">
                {u.label}
              </a>
            </span>
          ))}
        </p>
        <LicenseCheckForm shipperId={s.id} />
      </div>
    </div>
  );
}

type RateRow = {
  id: string;
  shipper_id: string;
  origin_region: string;
  origin_port: string | null;
  destination_country: string;
  vehicle_size_type: VehicleSizeType;
  shipping_method: ShippingMethod;
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
      {SHIPPER_FEES_ENABLED ? (
        <Detail label="Card on file">{s.card_on_file ? "Yes" : "No"}</Detail>
      ) : null}
      <Detail label="Terms accepted">
        {s.terms_accepted_at
          ? `${fmtDate.format(new Date(s.terms_accepted_at))}${s.terms_version ? ` · ${s.terms_version}` : ""}`
          : "Not recorded"}
      </Detail>
      <Detail label="Applied">
        {fmtDate.format(new Date(s.created_at))}
      </Detail>
    </dl>
  );
}

export default async function AdminShippersPage() {
  // Certificates are read with the service role, so check the admin (with
  // the authenticator code) first.
  if (!(await requireAdmin())) redirect("/login?next=/admin/shippers");
  const supabase = await createClient();
  const today = isoDay(new Date());

  const { data: shipperRows } = await supabase
    .from("shippers")
    .select(
      "id, company_name, contact_name, contact_email, contact_phone, fmc_oti_license_number, service_countries, status, payment_status, terms_accepted_at, terms_version, card_on_file, rejection_reason, created_at, coi_status, coi_document_path, coi_insurer, coi_cargo_limit_usd, coi_expires_on, coi_reviewed_at, license_status, license_checked_at",
    )
    .order("created_at", { ascending: true });

  const shippers = (shipperRows ?? []) as ShipperRow[];
  const pending = shippers.filter((s) => s.status === "pending");
  const approved = shippers.filter((s) => s.status === "approved");
  const suspended = approved.filter((s) => s.payment_status === "suspended");

  // Short-lived links to certificate files (the bucket has no read rule).
  const coiLinks = new Map<string, string>();
  const storage = createAdminClient().storage.from(SHIPPER_INSURANCE_BUCKET);
  for (const s of [...pending, ...approved]) {
    if (!s.coi_document_path) continue;
    const { data } = await storage.createSignedUrl(s.coi_document_path, 300);
    if (data?.signedUrl) coiLinks.set(s.id, data.signedUrl);
  }

  const approvedIds = approved.map((s) => s.id);
  const { data: rateRows } = approvedIds.length
    ? await supabase
        .from("shipping_rates")
        .select(
          "id, shipper_id, origin_region, origin_port, destination_country, vehicle_size_type, shipping_method, price, currency, active",
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
        className="font-mono text-xs uppercase tracking-wider text-gray-500 hover:text-black"
      >
        &larr; Admin dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-black">
        Shipper review
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        Approve applicants, manage their rates, and reinstate suspended shippers.
      </p>

      {/* Pending applications */}
      <section className="mt-8">
        <h2 className="font-mono text-xs uppercase tracking-wider text-gray-500">
          Pending applications ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">Nothing waiting for review.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-4">
            {pending.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-gray-200 bg-white p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-lg font-semibold text-black">
                    {s.company_name}
                  </h3>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-marine-50 px-2.5 py-1 text-sm font-medium text-marine-700">
                    Pending
                  </span>
                </div>
                <ShipperFacts s={s} />
                <VerificationPanel s={s} coiLink={coiLinks.get(s.id) ?? null} today={today} />
                {SHIPPER_FEES_ENABLED && !s.card_on_file ? (
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
          <h2 className="font-mono text-xs uppercase tracking-wider text-gray-500">
            Suspended ({suspended.length})
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Hidden from buyer-facing results until reinstated.
          </p>
          <ul className="mt-3 flex flex-col gap-4">
            {suspended.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-copper-100 bg-copper-50 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-lg font-semibold text-black">
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
        <h2 className="font-mono text-xs uppercase tracking-wider text-gray-500">
          Approved shippers ({approved.length})
        </h2>
        {approved.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">None yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-4">
            {approved.map((s) => {
              const rates = ratesByShipper.get(s.id) ?? [];
              return (
                <li
                  key={s.id}
                  className="rounded-lg border border-gray-200 bg-white p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-lg font-semibold text-black">
                      {s.company_name}
                    </h3>
                    <span className="inline-flex shrink-0 items-center rounded-full bg-verified-50 px-2.5 py-1 text-sm font-medium text-verified-600">
                      {PAYMENT_STATUS_LABEL[s.payment_status]}
                    </span>
                  </div>
                  <ShipperFacts s={s} />
                  <VerificationPanel s={s} coiLink={coiLinks.get(s.id) ?? null} today={today} />

                  <div className="mt-4 border-t border-gray-200 pt-4">
                    <p className="font-mono text-xs uppercase tracking-wider text-gray-500">
                      Rates ({rates.length}) — shown to buyers exactly as entered
                    </p>
                    {rates.length > 0 ? (
                      <ul className="mt-2 flex flex-col gap-2">
                        {rates.map((r) => (
                          <li
                            key={r.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 px-3 py-2 text-sm"
                          >
                            <span className="text-black">
                              {r.origin_region}
                              {r.origin_port ? ` (${r.origin_port})` : ""} &rarr;{" "}
                              {countryName(r.destination_country)}
                              {" · "}
                              {vehicleSizeLabel(r.vehicle_size_type)}
                              {" · "}
                              {shippingMethodLabel(r.shipping_method)}{" "}
                              · <strong>{money(Number(r.price), r.currency)}</strong>
                            </span>
                            <DeleteRateButton rateId={r.id} />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-gray-500">
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
