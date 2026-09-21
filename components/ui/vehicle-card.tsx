import Link from "next/link";
import { VinData } from "@/components/ui/vin-data";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { PriceBreakdown } from "@/components/ui/price-breakdown";
import type { FeeResponsibility, VinVerificationStatus } from "@/types/database";

/** The fields a vehicle card needs. Both /browse and the homepage select these. */
export interface VehicleCardData {
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
  /** Masked (or, once entitled, full) VIN — see `vehicle_vin_display` in lib/listings.ts. */
  vehicle_vin_display: string;
  vin_verification_status: VinVerificationStatus;
  /** Admin has confirmed the uploaded title (or authorization document) names
   * match the seller's verified identity — see migrations 0023/0031. Not a
   * claim that the title itself is authentic or lien-free, just that the
   * name check was done; keep the badge copy narrow to match. */
  title_identity_match_confirmed: boolean;
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
            {v.vin_verification_status === "verified" ? (
              <VerifiedBadge label="VIN Verified" />
            ) : null}
            {v.title_identity_match_confirmed ? (
              <VerifiedBadge label="Title reviewed" />
            ) : null}
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
          <VinData label="VIN" value={v.vehicle_vin_display} className="col-span-2" />
        </div>
      </div>
    </Link>
  );
}
