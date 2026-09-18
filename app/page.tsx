import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonClasses } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { VinData } from "@/components/ui/vin-data";
import { VehicleCard } from "@/components/ui/vehicle-card";
import { loadRecentApprovedListings } from "@/lib/listings";

export default async function Home() {
  // Live inventory for the listings grid — most recent approved listings,
  // newest first, same source as /browse.
  const supabase = await createClient();
  const { rows: listings, thumbByVehicle } = await loadRecentApprovedListings(
    supabase,
    8,
  );

  return (
    <main className="min-h-screen bg-white">
      <section className="bg-black text-white">
        <div className="mx-auto max-w-6xl px-6 pb-24 pt-16">
          <p className="font-mono text-sm uppercase tracking-widest text-gray-400">
            Houston, TX → Lagos, NG
          </p>
          <h1 className="mt-4 max-w-2xl text-5xl font-semibold leading-tight">
            American cars. Global buyers.
          </h1>
          <p className="mt-4 max-w-xl text-gray-300">
            MOVA connects verified U.S. sellers with international buyers —
            starting in Nigeria.
          </p>
          <div className="mt-8 flex gap-3">
            <Link
              href="/browse"
              className="inline-flex h-13 items-center justify-center rounded bg-white px-7 text-lg font-medium text-black hover:bg-gray-200"
            >
              Browse Vehicles
            </Link>
            <Link
              href="/seller/listings/new"
              className="inline-flex h-13 items-center justify-center rounded border border-white px-7 text-lg font-medium text-white hover:bg-white/10"
            >
              List Your Vehicle
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        {listings.length > 0 ? (
          <>
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <h2 className="font-mono text-xs uppercase tracking-wider text-gray-500">
                Latest verified listings
              </h2>
              <Link
                href="/browse"
                className="text-sm text-black hover:underline"
              >
                Browse all &rarr;
              </Link>
            </div>
            <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((v) => (
                <li key={v.id}>
                  <VehicleCard
                    vehicle={v}
                    thumbnailUrl={thumbByVehicle.get(v.id) ?? null}
                  />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <h2 className="mb-6 font-mono text-xs uppercase tracking-wider text-gray-500">
              Sample vehicle card — design system preview
            </h2>
            <div className="max-w-sm rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-start justify-between">
                <h3 className="text-lg font-semibold text-black">
                  2019 Toyota Camry SE
                </h3>
                <VerifiedBadge />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <VinData label="Mileage" value="62,000 mi" />
                <VinData label="Location" value="Houston, TX" />
                <VinData label="Price" value="$14,500" />
                <VinData label="VIN" value="4T1B11HK..." />
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

// The nav differs per viewer (signed-in vs not), so this page must be rendered
// per request and never served from a shared cache. `force-dynamic` renders on
// every request; `revalidate = 0` and the `Cache-Control` header for `/` in
// next.config.ts keep any CDN/proxy in front of it from handing one visitor's
// (e.g. a signed-in) HTML to the next (e.g. an anonymous incognito visitor).
export const dynamic = "force-dynamic";
export const revalidate = 0;
