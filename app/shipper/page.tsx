import { type ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buttonClasses } from "@/components/ui/button";
import { countryName } from "@/lib/shipping";
import type { ShipperPaymentStatus } from "@/types/database";
import { AddRateForm, RateList, type ShipperRate } from "./portal-rates";
import { ClaimButton, UpdateCardButton } from "./portal-actions";

const STANDING: Record<
  ShipperPaymentStatus,
  { label: string; cls: string; note: string }
> = {
  good_standing: {
    label: "Good standing",
    cls: "border-verified-100 bg-verified-50 text-verified-600",
    note: "Your active rates are shown to buyers normally.",
  },
  past_due: {
    label: "Past due",
    cls: "border-copper-100 bg-copper-50 text-copper-700",
    note: "A commission charge failed. Your rates still show to buyers but rank below shippers in good standing. Update the card on file so MOVA can retry.",
  },
  suspended: {
    label: "Suspended",
    cls: "border-copper-100 bg-copper-100 text-copper-700",
    note: "Your rates are hidden from buyers pending MOVA review. Contact MOVA to clear outstanding commission and be reinstated.",
  },
};

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link
        href="/"
        className="font-mono text-xs uppercase tracking-wider text-ink-400 hover:text-ink-900"
      >
        &larr; MOVA
      </Link>
      {children}
    </main>
  );
}

export default async function ShipperPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ claim?: string; card?: string }>;
}) {
  const { claim, card } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/shipper");

  // 1. Is this account already linked to a shipper?
  const { data: linked } = await supabase
    .from("shippers")
    .select(
      "id, company_name, status, payment_status, card_on_file, rejection_reason, service_countries, contact_email",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  // ---- Not linked: offer to claim, or explain there's nothing to manage ----
  if (!linked) {
    const { data: claimable } = user.email
      ? await supabase
          .from("shippers")
          .select("id, company_name, contact_email")
          .ilike("contact_email", user.email.replace(/([\\%_])/g, "\\$1"))
          .eq("status", "approved")
          .is("user_id", null)
          .maybeSingle()
      : { data: null };

    return (
      <Shell>
        <h1 className="mt-4 text-2xl font-semibold text-ink-900">
          Shipper portal
        </h1>
        <p className="mt-1 text-sm text-slate-500">Signed in as {user.email}</p>

        {claim === "failed" ? (
          <p className="mt-4 rounded border border-copper-100 bg-copper-50 p-3 text-sm text-copper-700">
            We couldn&rsquo;t link a shipper record to this account. Make sure
            you&rsquo;re signed in with the email address on your application.
          </p>
        ) : null}

        {claimable ? (
          <div className="mt-6 rounded-lg border border-paper-200 bg-paper-100 p-6">
            <p className="text-ink-900">
              We found an approved shipper application for{" "}
              <strong>{claimable.company_name}</strong> under {user.email}.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Link it to this account to manage your rates.
            </p>
            <div className="mt-4">
              <ClaimButton />
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-dashed border-paper-200 bg-paper-100 p-6">
            <p className="text-ink-900">
              No shipper record is linked to this account.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              If you&rsquo;ve applied, sign in with the email on your
              application. Otherwise, apply to list your rates.
            </p>
            <Link
              href="/shipper/signup"
              className={buttonClasses({ size: "sm", className: "mt-4" })}
            >
              Apply as a shipper
            </Link>
          </div>
        )}
      </Shell>
    );
  }

  // ---- Linked but not yet approved ----
  if (linked.status !== "approved") {
    return (
      <Shell>
        <h1 className="mt-4 text-2xl font-semibold text-ink-900">
          {linked.company_name}
        </h1>
        {linked.status === "pending" ? (
          <p className="mt-3 rounded border border-marine-100 bg-marine-50 p-3 text-sm text-marine-700">
            Your application is under review. You&rsquo;ll be able to add rates
            here once MOVA approves it.
          </p>
        ) : (
          <div className="mt-3 rounded border border-copper-100 bg-copper-50 p-3 text-sm text-copper-700">
            <p>Your application wasn&rsquo;t approved.</p>
            {linked.rejection_reason ? (
              <p className="mt-1">Reason: {linked.rejection_reason}</p>
            ) : null}
          </div>
        )}
      </Shell>
    );
  }

  // ---- Approved: the portal ----
  const [{ data: rateRows }, { count: shipmentCount }] = await Promise.all([
    supabase
      .from("shipping_rates")
      .select(
        "id, origin_region, origin_port, destination_country, vehicle_size_type, shipping_method, price, currency, active",
      )
      .eq("shipper_id", linked.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("shipment_requests")
      .select("id", { count: "exact", head: true })
      .eq("shipper_id", linked.id),
  ]);

  const rates = (rateRows ?? []) as ShipperRate[];
  const standing = STANDING[linked.payment_status];

  return (
    <Shell>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">
            {linked.company_name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Signed in as {user.email}</p>
        </div>
        <Link
          href="/shipper/profile"
          className={buttonClasses({ size: "sm", variant: "secondary" })}
        >
          Edit profile
        </Link>
      </div>

      {claim === "ok" ? (
        <p className="mt-4 rounded border border-verified-100 bg-verified-50 p-3 text-sm text-verified-600">
          Account linked. You can manage your rates below.
        </p>
      ) : null}
      {card === "updated" ? (
        <p className="mt-4 rounded border border-verified-100 bg-verified-50 p-3 text-sm text-verified-600">
          Card updated — MOVA will use it for future commission charges.
        </p>
      ) : null}
      {card === "error" ? (
        <p className="mt-4 rounded border border-copper-100 bg-copper-50 p-3 text-sm text-copper-700">
          We couldn&rsquo;t open Stripe just now. Please try again.
        </p>
      ) : null}

      {/* Account standing */}
      <section className={`mt-6 rounded-lg border p-4 ${standing.cls}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold">Account standing: {standing.label}</p>
          <UpdateCardButton hasCard={linked.card_on_file} />
        </div>
        <p className="mt-1 text-sm">{standing.note}</p>
        {!linked.card_on_file ? (
          <p className="mt-1 text-sm">
            No card on file — add one so MOVA can collect commission on completed
            shipments.
          </p>
        ) : null}
      </section>

      {/* Rates */}
      <section className="mt-10">
        <h2 className="font-mono text-xs uppercase tracking-wider text-ink-400">
          Your rates ({rates.length}) · serving{" "}
          {linked.service_countries.map(countryName).join(", ") || "—"}
        </h2>
        <RateList rates={rates} />
        <AddRateForm />
      </section>

      {/* Shipments — full list, one-tap status updates, proof photos and
          buyer contact live on the dedicated dashboard now. */}
      <section className="mt-10">
        <h2 className="font-mono text-xs uppercase tracking-wider text-ink-400">
          Shipments ({shipmentCount ?? 0})
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {shipmentCount
            ? "Update pickup/delivery status, upload proof photos and message buyers."
            : "None yet. When a buyer selects one of your rates it appears here."}
        </p>
        <Link
          href="/shipper/dashboard"
          className={buttonClasses({ size: "sm", className: "mt-3" })}
        >
          Manage shipments
        </Link>
      </section>
    </Shell>
  );
}

export const dynamic = "force-dynamic";
