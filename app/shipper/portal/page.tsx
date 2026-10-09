import { type ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  DashboardHeader,
  DashboardSection,
  DashboardShell,
  DashboardTile,
  EmptyCard,
  Notice,
  StickyAction,
} from "@/components/ui/dashboard";
import { cardClasses } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { SHIPPER_FEES_ENABLED, SHIPPER_NO_FEES_HEADLINE, countryName } from "@/lib/shipping";
import type { ShipperPaymentStatus } from "@/types/database";
import { AddRateForm, RateList, type ShipperRate } from "./portal-rates";
import { ClaimButton, UpdateCardButton } from "./portal-actions";
import { InsuranceSection } from "./insurance-section";

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
    note: "A commission charge failed. Your rates still show to buyers but rank below shippers in good standing. Update the card on file so ShipMova can retry.",
  },
  suspended: {
    label: "Suspended",
    cls: "border-copper-100 bg-copper-100 text-copper-700",
    note: "Your rates are hidden from buyers pending ShipMova review. Contact ShipMova to clear outstanding commission and be reinstated.",
  },
};

function Shell({ children }: { children: ReactNode }) {
  return (
    <DashboardShell narrow>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Shipper portal</p>
      {children}
    </DashboardShell>
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
  if (!user) redirect("/login?next=/shipper/portal");

  // 1. Is this account already linked to a shipper?
  const { data: linked } = await supabase
    .from("shippers")
    .select(
      "id, company_name, status, payment_status, card_on_file, rejection_reason, service_countries, contact_email, coi_status, coi_expires_on, coi_cargo_limit_usd, coi_insurer, coi_review_note, license_status",
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
          .in("status", ["pending", "approved"])
          .is("user_id", null)
          .maybeSingle()
      : { data: null };

    return (
      <Shell>
        <DashboardHeader className="mt-1" title="Welcome" intro={`Signed in as ${user.email}`} />

        {claim === "failed" ? (
          <Notice tone="warning" role="alert" className="mt-4">
            We couldn&rsquo;t link a shipper record to this account. Make sure
            you&rsquo;re signed in with the email address on your application.
          </Notice>
        ) : null}

        {claimable ? (
          <div className={cardClasses({ className: "mt-6" })}>
            <p className="text-ink">
              We found a shipper application for{" "}
              <strong>{claimable.company_name}</strong> under {user.email}.
            </p>
            <p className="mt-1 text-sm text-muted">
              Link it to this account to send your insurance certificate and manage your rates.
            </p>
            <div className="mt-4">
              <ClaimButton />
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <EmptyCard
              title="No shipper record is linked to this account"
              action={
                <Link href="/shipper/signup" className={buttonClasses({ className: "w-full sm:w-auto" })}>
                  Apply as a shipper
                </Link>
              }
            >
              If you&rsquo;ve applied, sign in with the email on your application. Otherwise, apply to
              list your rates.
            </EmptyCard>
          </div>
        )}
      </Shell>
    );
  }

  // ---- Linked but not yet approved ----
  if (linked.status !== "approved") {
    return (
      <Shell>
        <DashboardHeader className="mt-1" title={linked.company_name} />
        {linked.status === "pending" ? (
          <>
            <Notice tone="info" className="mt-4">
              Your application is under review. ShipMova approves it once your insurance
              certificate and FMC/OTI license are checked; then you can add rates here.
            </Notice>
            <InsuranceSection userId={user.id} s={linked} />
          </>
        ) : (
          <Notice tone="warning" className="mt-4">
            <p>Your application wasn&rsquo;t approved.</p>
            {linked.rejection_reason ? (
              <p className="mt-1">Reason: {linked.rejection_reason}</p>
            ) : null}
          </Notice>
        )}
      </Shell>
    );
  }

  // ---- Approved: the portal ----
  const [{ data: rateRows }, { count: shipmentCount }] = await Promise.all([
    supabase
      .from("shipping_rates")
      .select(
        "id, origin_region, origin_port, destination_country, vehicle_size_type, shipping_method, price, currency, active, inland_price",
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

  const editProfile = (
    <Link href="/shipper/profile" className={buttonClasses({ variant: "secondary", className: "w-full sm:w-auto" })}>
      Edit profile
    </Link>
  );

  return (
    <Shell>
      <DashboardHeader
        className="mt-1"
        title={linked.company_name}
        intro={`Signed in as ${user.email}`}
        action={editProfile}
      />

      {claim === "ok" ? (
        <Notice tone="success" role="status" className="mt-4">
          Account linked. You can manage your rates below.
        </Notice>
      ) : null}
      {SHIPPER_FEES_ENABLED && card === "updated" ? (
        <Notice tone="success" role="status" className="mt-4">
          Card updated — ShipMova will use it for future commission charges.
        </Notice>
      ) : null}
      {SHIPPER_FEES_ENABLED && card === "error" ? (
        <Notice tone="warning" role="alert" className="mt-4">
          We couldn&rsquo;t open Stripe just now. Please try again.
        </Notice>
      ) : null}

      {/* Shipments first: it's what a shipper opens the portal for. Full
          list, one-tap status updates, proof photos and buyer contact live
          on the dedicated dashboard. */}
      <nav aria-label="Shipper areas" className="mt-6 grid gap-3 sm:grid-cols-2">
        <DashboardTile
          href="/shipper/dashboard"
          title="Shipments"
          body={
            shipmentCount
              ? `${shipmentCount} shipment${shipmentCount === 1 ? "" : "s"} · status, photos, buyer contact`
              : "None yet — they appear when a buyer picks your rate"
          }
        />
        <DashboardTile href="/shipper/profile" title="Profile & reviews" body="What buyers see about you" />
      </nav>

      <InsuranceSection userId={user.id} s={linked} />

      {/* Account standing. While shipper fees are off (lib/shipping.ts) there's
          no card, no charge and so nothing that can change standing. */}
      {SHIPPER_FEES_ENABLED ? (
        <section className={`mt-6 rounded-card border p-5 ${standing.cls}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">Account standing: {standing.label}</p>
            <UpdateCardButton hasCard={linked.card_on_file} />
          </div>
          <p className="mt-1 text-sm">{standing.note}</p>
          {!linked.card_on_file ? (
            <p className="mt-1 text-sm">
              No card on file — add one so ShipMova can collect commission on completed
              shipments.
            </p>
          ) : null}
        </section>
      ) : (
        <Notice tone="success" className="mt-6 p-4">
          <p className="font-semibold">{SHIPPER_NO_FEES_HEADLINE}</p>
          <p className="mt-1">
            ShipMova charges you nothing: no commission and no card on file. Your
            active rates are shown to buyers.
          </p>
        </Notice>
      )}

      <DashboardSection title={`Your rates (${rates.length})`}>
        <p className="text-sm text-muted">
          Serving {linked.service_countries.map(countryName).join(", ") || "—"}
        </p>
        <RateList rates={rates} />
        <AddRateForm />
      </DashboardSection>

      <StickyAction>
        <Link href="/shipper/dashboard" className={buttonClasses({ className: "w-full" })}>
          Manage shipments
        </Link>
      </StickyAction>
    </Shell>
  );
}

export const dynamic = "force-dynamic";
