import Link from "next/link";
import { VinData } from "@/components/ui/vin-data";
import { PriceBreakdown } from "@/components/ui/price-breakdown";
import type { FeeResponsibility } from "@/types/database";

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
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-paper-200 bg-paper-100 shadow-sm transition-colors hover:border-marine"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-paper-200">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt={`${v.year} ${v.make} ${v.model}`}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-mono text-xs uppercase tracking-wider text-ink-400">
            No photo
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <h2 className="text-lg font-semibold text-ink-900">
          {v.year} {v.make} {v.model}
          {v.trim ? ` ${v.trim}` : ""}
        </h2>
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
        </div>
      </div>
    </Link>
  );
}
