import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ReportIssuePanel } from "@/components/ui/report-issue-panel";
import { DisputeStatusList, type DisputeSummary } from "@/components/ui/dispute-status";
import { BuyerIdSummary } from "@/components/buyer-id-summary";
import { cardClasses } from "@/components/ui/card";
import {
  BackLink,
  DashboardHeader,
  DashboardShell,
  EmptyCard,
  Notice,
  StatusPill,
  type PillTone,
} from "@/components/ui/dashboard";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const submitted = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const RESERVATION_LABEL: Record<string, string> = {
  submitted: "Submitted",
  under_review: "In review",
  verified: "Verified",
  completed: "Completed",
  rejected: "Not accepted",
  cancelled: "Released",
};

const RESERVATION_TONE: Record<string, PillTone> = {
  submitted: "info",
  under_review: "info",
  verified: "success",
  completed: "success",
  rejected: "warning",
  cancelled: "neutral",
};

const RESERVATION_STATUS_COPY: Record<string, string> = {
  submitted: "Submitted — waiting for ShipMova to review.",
  under_review: "ShipMova is reviewing this request.",
  verified: "Verified — ShipMova is in touch with the buyer on next steps.",
  completed: "Completed.",
  rejected: "Not accepted.",
  cancelled: "Released.",
};

/**
 * Reservations against this seller's own listings. There was no seller-
 * facing view of purchase_requests at all before this — "My listings"
 * (app/seller/listings) only ever showed a one-line "buyer has paid" banner
 * per vehicle. This is deliberately minimal: enough context to file or see
 * a dispute against a specific reservation, not a redesign of the seller
 * experience.
 *
 * No buyer identity/contact is shown — sellers never see that anywhere in
 * the app (buyers and sellers talk through ShipMova's filtered chat), and the
 * "users read own" RLS policy wouldn't let this query read the buyer's row
 * anyway.
 */
export default async function SellerReservationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, year, make, model, trim, price_usd")
    .eq("seller_id", user!.id);

  const vehicleRows = vehicles ?? [];
  const vehicleById = new Map(vehicleRows.map((v) => [v.id, v]));
  const vehicleIds = vehicleRows.map((v) => v.id);

  const { data: reservationRows } = vehicleIds.length
    ? await supabase
        .from("purchase_requests")
        .select(
          "id, reference, vehicle_id, buyer_id, status, created_at, vehicle_price_usd, mova_fee_payment_status",
        )
        .in("vehicle_id", vehicleIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const reservations = reservationRows ?? [];
  const reservationIds = reservations.map((r) => r.id);

  // What was checked on each buyer's ID (never the ID itself).
  const buyerIds = [...new Set(reservations.map((r) => r.buyer_id))];
  const idSummaries = new Map(
    await Promise.all(
      buyerIds.map(async (b) => {
        const { data } = await supabase.rpc("buyer_id_summary", { p_buyer_id: b });
        return [b, data ?? null] as const;
      }),
    ),
  );

  const { data: disputeRows } = reservationIds.length
    ? await supabase
        .from("disputes")
        .select(
          "id, purchase_request_id, category, status, description, decision_reason, decision_amount_usd, reporter_id, created_at",
        )
        .in("purchase_request_id", reservationIds)
    : { data: [] };

  const disputesByReservation = new Map<string, DisputeSummary[]>();
  for (const d of disputeRows ?? []) {
    const list = disputesByReservation.get(d.purchase_request_id) ?? [];
    list.push(d);
    disputesByReservation.set(d.purchase_request_id, list);
  }

  return (
    <DashboardShell>
      <BackLink href="/seller/dashboard">Seller dashboard</BackLink>
      <DashboardHeader
        className="mt-2"
        title="Reservations"
        intro={
          reservations.length === 0
            ? "No reservations against your listings yet."
            : `${reservations.length} reservation${reservations.length === 1 ? "" : "s"}`
        }
      />

      {reservations.length === 0 ? (
        <div className="mt-6">
          <EmptyCard title="Nothing here yet">
            When a buyer reserves one of your listings, it shows up here.
          </EmptyCard>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {reservations.map((r) => {
            const vehicle = vehicleById.get(r.vehicle_id);
            const title = vehicle
              ? `${vehicle.year} ${vehicle.make} ${vehicle.model}${
                  vehicle.trim ? ` ${vehicle.trim}` : ""
                }`
              : "Listing unavailable";
            const price =
              r.vehicle_price_usd != null
                ? Number(r.vehicle_price_usd)
                : vehicle
                  ? Number(vehicle.price_usd)
                  : null;
            const disputes = disputesByReservation.get(r.id) ?? [];
            const hasOwnOpenDispute = disputes.some(
              (d) => d.reporter_id === user!.id && d.status === "open",
            );

            return (
              <li key={r.id} className={cardClasses()}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusPill tone={RESERVATION_TONE[r.status] ?? "neutral"}>
                    {RESERVATION_LABEL[r.status] ?? r.status}
                  </StatusPill>
                  <span className="text-xs text-muted">
                    <span className="font-mono">{r.reference}</span> · {submitted.format(new Date(r.created_at))}
                  </span>
                </div>
                <div>
                  <div>
                    <h2 className="mt-3 break-words font-display text-xl font-bold leading-snug text-ink">
                      {vehicle ? (
                        <Link href={`/browse/${r.vehicle_id}`} className="hover:underline">
                          {title}
                        </Link>
                      ) : (
                        title
                      )}
                    </h2>
                    {price != null ? (
                      <p className="mt-1 text-sm font-semibold tabular-nums text-ink">
                        {usd.format(price)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {RESERVATION_STATUS_COPY[r.status] ?? r.status}
                </p>
                <BuyerIdSummary summary={idSummaries.get(r.buyer_id) ?? null} />
                {r.mova_fee_payment_status === "paid" ? (
                  <Notice tone="success" className="mt-3">
                    Buyer has paid ShipMova&rsquo;s fee. Next they pay the car price
                    into Escrow.com; you&rsquo;re paid once an inspector confirms
                    the car and a licensed shipper collects it with the title.
                  </Notice>
                ) : null}

                <DisputeStatusList disputes={disputes} currentUserId={user!.id} />
                {!hasOwnOpenDispute ? <ReportIssuePanel purchaseRequestId={r.id} /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </DashboardShell>
  );
}
