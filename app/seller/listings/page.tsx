import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { createClient } from "@/lib/supabase/server";
import { VEHICLE_DETAIL_COLUMNS, loadFullVins } from "@/lib/listings";
import { canSubmitForReview } from "@/lib/listings-review";
import { badgeFacts, listingBadges } from "@/lib/listing-badges";
import { displayPlace } from "@/lib/place";
import { cardClasses } from "@/components/ui/card";
import {
  BackLink,
  DashboardHeader,
  DashboardShell,
  EmptyCard,
  Notice,
  StatusPill,
  StickyAction,
  type PillTone,
} from "@/components/ui/dashboard";
import { buttonClasses } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import type { FeeResponsibility, VehicleStatus } from "@/types/database";
import { submitForReview } from "./actions";
import { SubmitForReviewButton } from "./submit-for-review-button";
import { RemoveListingButton } from "./remove-listing-button";
import { SELLER_ARCHIVABLE_STATUSES } from "@/lib/listing-removal";

const STATUS_META: Record<VehicleStatus, { label: string; tone: PillTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  pending_review: { label: "Pending review", tone: "info" },
  approved: { label: "Live", tone: "success" },
  rejected: { label: "Rejected", tone: "warning" },
  sold: { label: "Sold", tone: "neutral" },
  archived: { label: "Removed", tone: "neutral" },
};

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const FEE_LABEL: Record<FeeResponsibility, string> = {
  buyer_pays_full: "Buyer pays ShipMova's full 8% fee",
  split: "Seller splits the fee — your 4% comes out of your escrow payout",
};

/**
 * A listing's moderation status. Deliberately NOT <VerifiedBadge> for
 * 'approved' any more: that put a green check-mark badge — the same component
 * the verification badges use — on what is only "an admin let this go live".
 * Verification is stated separately below, by the real badge rules.
 */
function StatusBadge({ status }: { status: VehicleStatus }) {
  const meta = STATUS_META[status];
  return <StatusPill tone={meta.tone}>{meta.label}</StatusPill>;
}

export default async function SellerListingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: listings } = await supabase
    .from("vehicles")
    .select(VEHICLE_DETAIL_COLUMNS)
    .eq("seller_id", user!.id)
    .order("created_at", { ascending: false });

  const rows = listings ?? [];
  const fullVinById = await loadFullVins(
    supabase,
    rows.map((v) => v.id),
  );

  // Reservations where the buyer has already paid ShipMova's fee — next the car
  // price goes into Escrow.com, and the seller is paid out of escrow.
  const vehicleIds = rows.map((v) => v.id);
  const { data: paidReqs } = vehicleIds.length
    ? await supabase
        .from("purchase_requests")
        .select("vehicle_id, vehicle_price_usd")
        .in("vehicle_id", vehicleIds)
        .eq("mova_fee_payment_status", "paid")
        .order("created_at", { ascending: false })
    : { data: [] };

  const paidByVehicle = new Map<string, { vehicle_price_usd: number | null }>();
  for (const p of paidReqs ?? []) {
    if (!paidByVehicle.has(p.vehicle_id)) {
      paidByVehicle.set(p.vehicle_id, { vehicle_price_usd: p.vehicle_price_usd });
    }
  }

  const newListing = (
    <Link href="/seller/listings/new" className={buttonClasses({ className: "w-full sm:w-auto" })}>
      New listing
    </Link>
  );

  return (
    <DashboardShell>
      <BackLink href="/seller/dashboard">Seller dashboard</BackLink>
      <DashboardHeader
        className="mt-2"
        title="My listings"
        intro={
          rows.length === 0
            ? "Add your first car to get it in front of buyers."
            : `${rows.length} listing${rows.length === 1 ? "" : "s"}`
        }
        action={newListing}
      />

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyCard title="No listings yet" action={newListing}>
            Add your first vehicle to get it in front of buyers.
          </EmptyCard>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {rows.map((v) => {
            const badges = listingBadges(badgeFacts(v), v.status);
            const canSubmit =
              v.status === "draft" &&
              canSubmitForReview({
                hasTitleDocument: v.has_title_document,
                notTitledOwner: v.not_titled_owner,
                hasAuthorizationDocument: v.has_authorization_document,
              });
            const paid = paidByVehicle.get(v.id);
            return (
              <li key={v.id} className={cardClasses()}>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={v.status} />
                  {badges.verifiedListing ? <VerifiedBadge className="text-xs" /> : null}
                  {badges.vinVerified ? <VerifiedBadge label="VIN Verified" className="text-xs" /> : null}
                  {badges.titleReviewed ? <VerifiedBadge label="Title reviewed" className="text-xs" /> : null}
                </div>
                <h2 className="mt-3 break-words font-display text-xl font-bold leading-snug text-ink">
                  {v.year} {v.make} {v.model}
                  {v.trim ? ` ${v.trim}` : ""}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  <span className="font-semibold tabular-nums text-ink">{usd.format(Number(v.price_usd))}</span>
                  {" · "}
                  <span className="tabular-nums">{v.mileage.toLocaleString("en-US")} mi</span>
                  {" · "}
                  {displayPlace(v.location_city, v.location_state)}
                </p>
                <p className="mt-1 break-all font-mono text-xs uppercase tracking-wider text-muted">
                  VIN {fullVinById.get(v.id) ?? v.vin_masked}
                  {v.vin_decode_status === "mismatch" ? " · VIN mismatch flagged" : ""}
                </p>
                <p className="mt-1 text-xs text-muted">{FEE_LABEL[v.fee_responsibility]}</p>

                {v.vin_verification_status === "flagged" ? (
                  <Notice tone="warning" className="mt-3">
                    This listing&rsquo;s VIN was flagged during admin review and can&rsquo;t be approved
                    until that&rsquo;s resolved. Contact support.
                  </Notice>
                ) : null}
                {v.status === "rejected" && v.rejection_reason ? (
                  <Notice tone="warning" className="mt-3">
                    Reason: {v.rejection_reason}
                  </Notice>
                ) : null}
                {paid ? (
                  <Notice tone="success" className="mt-3">
                    A buyer has paid ShipMova&rsquo;s fee
                    {paid.vehicle_price_usd != null ? ` at ${usd.format(Number(paid.vehicle_price_usd))}` : ""}.
                    Next they pay the car price into Escrow.com; you&rsquo;re paid once an inspector
                    confirms the car and a licensed shipper collects it with the title.
                  </Notice>
                ) : null}
                {v.status === "draft" && !canSubmit ? (
                  <Notice tone="warning" className="mt-3">
                    {!v.has_title_document
                      ? "This draft predates the title-upload requirement — it needs a title photo before it can be submitted for review."
                      : "Missing the authorization document required for a non-owner seller before this can be submitted for review."}
                  </Notice>
                ) : null}

                {/* Two per row on phones (each button half the card, text
                    never wider than its button); one row from sm up. The
                    main action, when there is one, spans the full width. */}
                <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  {canSubmit ? (
                    <ActionForm action={submitForReview} className="col-span-2 sm:col-auto">
                      <input type="hidden" name="id" value={v.id} />
                      <SubmitForReviewButton />
                    </ActionForm>
                  ) : null}
                  {/* Opens the listing page exactly as buyers see it; for a
                      listing that isn't live yet, only its seller can. */}
                  <Link href={`/browse/${v.id}`} className={buttonClasses({ variant: "secondary", size: "sm", className: "w-full px-2 sm:w-auto sm:px-4" })}>
                    {v.status === "approved" ? "View listing" : "Preview listing"}
                  </Link>
                  <Link
                    href={`/seller/listings/${v.id}/photos`}
                    className={buttonClasses({ variant: "secondary", size: "sm", className: "w-full px-2 sm:w-auto sm:px-4" })}
                  >
                    Edit photos
                  </Link>
                  {SELLER_ARCHIVABLE_STATUSES.includes(v.status) ? (
                    <RemoveListingButton
                      vehicleId={v.id}
                      isLive={v.status === "approved"}
                      className="col-span-2 sm:col-auto"
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <StickyAction>{newListing}</StickyAction>
    </DashboardShell>
  );
}
