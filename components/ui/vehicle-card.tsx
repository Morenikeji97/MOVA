import Link from "next/link";
import { VinData } from "@/components/ui/vin-data";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { PriceBreakdown, SellerSplitsFeeBadge } from "@/components/ui/price-breakdown";
import type { FeeResponsibility } from "@/types/database";
import {
  badgeFacts,
  hasTitleReviewedBadge,
  hasVerifiedListingBadge,
  type ListingBadgeRow,
} from "@/lib/listing-badges";

/** The fields a vehicle card needs. Both /browse and the homepage select these. */
export interface VehicleCardData extends ListingBadgeRow {
  id: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  price_usd: number;
  fee_responsibility: FeeResponsibility;
  mileage: number;
  location_city: string;
  location_state: string;
  /** Masked VIN (last 6) — a card never shows the full VIN. See lib/listings.ts. */
  vin_masked: string | null;
}

/**
 * The listing card used across the browse grid and the homepage. Links to the
 * vehicle detail page. Kept as one component so the two surfaces can't drift.
 */
export function VehicleCard({
  vehicle: v,
  thumbnailUrl,
}: {
  vehicle: VehicleCardData;
  thumbnailUrl: string | null;
}) {
  // Badge rules live in lib/listing-badges.ts, shared with /browse/[id] and
  // the seller's own listings so the three surfaces can't disagree about what
  // has actually been checked. "Title reviewed" is NOT
  // title_identity_match_confirmed on its own — see migration 0032.
  const facts = badgeFacts(v);
  const titleReviewed = hasTitleReviewedBadge(facts);
  const verifiedListing = hasVerifiedListingBadge(facts);

  return (
    <Link
      href={`/browse/${v.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-colors hover:border-black"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt={`${v.year} ${v.make} ${v.model}`}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-mono text-xs uppercase tracking-wider text-gray-500">
            No photo
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-black">
            {v.year} {v.make} {v.model}
            {v.trim ? ` ${v.trim}` : ""}
          </h2>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {verifiedListing ? <VerifiedBadge /> : null}
            {v.vin_verification_status === "verified" ? (
              <VerifiedBadge label="VIN Verified" />
            ) : null}
            {titleReviewed ? <VerifiedBadge label="Title reviewed" /> : null}
            {v.fee_responsibility === "split" ? <SellerSplitsFeeBadge /> : null}
          </div>
        </div>
        <PriceBreakdown
          price={Number(v.price_usd)}
          feeResponsibility={v.fee_responsibility}
        />
        <div className="mt-auto grid grid-cols-2 gap-3 pt-1">
          <VinData
            label="Mileage"
            value={`${v.mileage.toLocaleString("en-US")} mi`}
          />
          <VinData
            label="Location"
            value={`${v.location_city}, ${v.location_state}`}
          />
          <VinData label="VIN" value={v.vin_masked ?? "—"} className="col-span-2" />
        </div>
      </div>
    </Link>
  );
}
