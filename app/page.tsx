import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonClasses } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { VinData } from "@/components/ui/vin-data";
import { VehicleCard } from "@/components/ui/vehicle-card";
import { loadRecentApprovedListings } from "@/lib/listings";
import { SELLER_SPLITS_FEE_BADGE } from "@/lib/fees";
import { isPrelaunch } from "@/lib/prelaunch";
import { WaitlistForm } from "@/components/ui/waitlist-form";
import { WhyBuy } from "@/components/ui/why-buy";

const TRUST_STRIP = [
  "Verified sellers",
  "Title checked",
  "Escrow-protected payment",
  "Inspected before pickup",
];

const FEE_COVERS = [
  { title: "Seller identity", body: "government ID check before any listing goes live." },
  { title: "Ownership", body: "the name on the title must match the verified seller." },
  {
    title: "VIN and title history",
    body: "checked against U.S. national title records for salvage, junk, flood and odometer problems, and against theft records.",
  },
  {
    title: "Import check",
    body: "we flag cars that can't legally enter your country before you pay anything.",
  },
  {
    title: "In-person inspection",
    body: "an independent inspector checks the car, VIN, mileage and title at pickup.",
  },
  {
    title: "Verified shippers",
    body: "licensed, bonded and insured for cargo. We check this ourselves, not from their paperwork.",
  },
  {
    title: "Protected payment",
    body: "your money is held by Escrow.com, a licensed escrow company, never sent to the seller or ShipMova directly.",
  },
  {
    title: "Support until it ships",
    body: "secure messaging, dispute handling, and a real person on WhatsApp.",
  },
];

const MONEY_STEPS = [
  "You pay ShipMova's fee by card. It covers verification and coordination.",
  "You pay the car price into Escrow.com. It's held there — not by the seller, not by ShipMova.",
  "An inspector checks the car in person and confirms it matches the listing.",
  "Your shipper collects the car and the original title. U.S. law requires the original title for export.",
  "Only then does Escrow.com pay the seller.",
  "Your car ships and you track it to your port. Your shipper's cargo insurance covers it at sea.",
];

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
        <div className="mx-auto max-w-6xl px-6 pb-20 pt-16">
          <p className="font-mono text-sm uppercase tracking-widest text-gray-400">
            USA → West Africa
          </p>
          <h1 className="mt-4 max-w-2xl text-5xl font-semibold leading-tight">
            American cars. Global buyers.
          </h1>
          <p className="mt-4 max-w-xl text-gray-300">
            Buy directly from verified U.S. sellers. Your payment is held by
            Escrow.com, and the seller isn&rsquo;t paid until the car is
            inspected and in your shipper&rsquo;s hands.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/browse"
              className="inline-flex h-13 items-center justify-center rounded bg-white px-7 text-lg font-medium text-black hover:bg-gray-200"
            >
              Browse vehicles
            </Link>
            <Link
              href="/sell"
              className="inline-flex h-13 items-center justify-center rounded border border-white px-7 text-lg font-medium text-white hover:bg-white/10"
            >
              Sell your car
            </Link>
          </div>
          <ul className="mt-10 flex flex-wrap gap-x-3 gap-y-2 font-mono text-xs uppercase tracking-wider text-gray-300">
            {TRUST_STRIP.map((item, i) => (
              <li key={item} className="flex items-center gap-3">
                {i > 0 ? <span aria-hidden className="text-gray-500">·</span> : null}
                {item}
              </li>
            ))}
          </ul>
          <Link
            href="/how-it-works"
            className="mt-6 inline-block text-sm text-white underline underline-offset-4 hover:text-gray-300"
          >
            Buying from West Africa? See exactly how it works &rarr;
          </Link>
        </div>
      </section>

      <WhyBuy waitlistHref={isPrelaunch() ? "#waitlist" : null} />

      {isPrelaunch() ? (
        <section id="waitlist" className="scroll-mt-4 border-y border-gray-200 bg-gray-100">
          <div className="mx-auto max-w-6xl px-6 py-10">
            <WaitlistForm source="home" className="max-w-3xl" />
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-6 py-16">
        {listings.length > 0 ? (
          <>
            <div className="mb-6 flex items-baseline justify-between gap-4">
              {/* "Latest verified listings" until 0032: the grid is simply the
                  most recent APPROVED listings, and approval is a moderation
                  outcome, not a verification result — most rows here carry no
                  verified badge at all. The per-card badges now state what was
                  actually checked; the heading no longer overclaims on their
                  behalf. */}
              <h2 className="font-mono text-xs uppercase tracking-wider text-gray-500">
                Latest listings
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
      <section className="border-t border-gray-200">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-semibold text-black">What the 8% covers</h2>
          <p className="mt-3 max-w-2xl text-gray-500">
            Every car on ShipMova goes through checks you can&rsquo;t easily do
            yourself from your country:
          </p>
          <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FEE_COVERS.map((item) => (
              <li key={item.title} className="rounded-lg border border-gray-200 bg-white p-5">
                <p className="font-semibold text-black">{item.title}</p>
                <p className="mt-1 text-sm text-gray-500">{item.body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-2xl text-sm text-gray-500">
            ShipMova&rsquo;s fee is 8% of the car price, shown before you commit. On
            some listings the seller pays half — look for the &ldquo;
            {SELLER_SPLITS_FEE_BADGE}&rdquo; badge. Escrow.com&rsquo;s fee is
            shown separately.
          </p>
        </div>
      </section>

      <section className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-semibold text-black">
            Your money never goes to a stranger
          </h2>
          <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {MONEY_STEPS.map((step, i) => (
              <li key={step} className="flex gap-4 rounded-lg border border-gray-200 bg-white p-5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black font-mono text-sm text-white">
                  {i + 1}
                </span>
                <p className="text-sm text-black">{step}</p>
              </li>
            ))}
          </ol>
          <div className="mt-6 max-w-2xl rounded-lg border border-copper-100 bg-copper-50 p-5">
            <p className="font-semibold text-copper-700">ShipMova will never&hellip;</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-copper-700">
              <li>send you bank details on WhatsApp, email or text</li>
              <li>ask you to pay a person directly</li>
              <li>change payment instructions after you&rsquo;ve started</li>
            </ul>
            <p className="mt-2 text-sm font-medium text-copper-700">
              If anyone does, it&rsquo;s a scam — stop and message us.
            </p>
          </div>
        </div>
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
