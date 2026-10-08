import Link from "next/link";
import { VinData } from "@/components/ui/vin-data";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { PriceBreakdown, SellerSplitsFeeBadge } from "@/components/ui/price-breakdown";
import { ImportBadge } from "@/components/ui/import-badge";
import { mediaUrl } from "@/lib/media-url";
import { CarIcon } from "@/components/ui/icons";
import type { FeeResponsibility } from "@/types/database";
import type { FxCurrency, FxRates } from "@/lib/fx-format";
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
  /** VIN position 10, for the Nigeria import badge (lib/import-rules.ts). */
  vin_model_year_code: string | null;
}

/**
 * The listing card used across the browse grid and the homepage. Links to the
 * vehicle detail page. Kept as one component so the two surfaces can't drift.
 */
export function VehicleCard({
  vehicle: v,
  thumbnailUrl,
  fx = null,
  localCurrencies = ["NGN"],
}: {
  vehicle: VehicleCardData;
  thumbnailUrl: string | null;
  /** Shows the total in a local currency too; the page renders <FxNote> once. */
  fx?: FxRates | null;
  /** From the header's currency switcher (lib/display-currency.ts); [] = dollars only. */
  localCurrencies?: FxCurrency[];
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
      className="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-white shadow-card transition-colors hover:border-ink"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-band">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl(thumbnailUrl)}
            alt={`${v.year} ${v.make} ${v.model}`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            <CarIcon size={28} />
            No photo
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-bold leading-snug text-ink">
            {v.year} {v.make} {v.model}
            {v.trim ? ` ${v.trim}` : ""}
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {verifiedListing ? <VerifiedBadge /> : null}
            {v.vin_verification_status === "verified" ? (
              <VerifiedBadge label="VIN Verified" />
            ) : null}
            {titleReviewed ? <VerifiedBadge label="Title reviewed" /> : null}
            {v.fee_responsibility === "split" ? <SellerSplitsFeeBadge /> : null}
          </div>
        </div>
        <ImportBadge
          vinModelYearCode={v.vin_model_year_code}
          year={v.year}
          className="self-start text-xs"
        />
        <PriceBreakdown
          price={Number(v.price_usd)}
          feeResponsibility={v.fee_responsibility}
          local={fx && localCurrencies.length ? { fx, currencies: localCurrencies } : null}
        />
        <div className="mt-auto grid grid-cols-2 gap-3 border-t border-line pt-3">
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
