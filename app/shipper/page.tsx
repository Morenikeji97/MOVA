import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, FileCheck, MapPin, Receipt, Rocket } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { BenefitsSection, type Benefit } from "@/components/ui/benefits-section";
import { whatsappLink } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Ship with ShipMova",
  description: "Verified cars, paid-up buyers and clean paperwork, ready to move.",
};

const SHIPPER_BENEFITS: Benefit[] = [
  {
    icon: Rocket,
    title: "Jobs that are ready to go",
    body: "The buyer has already paid into escrow and the car is verified before you're booked.",
  },
  {
    icon: FileCheck,
    title: "Clean title handoff",
    body: "The title is checked against the seller's verified ID before pickup, and you collect the original at pickup.",
  },
  {
    icon: MapPin,
    title: "Local jobs first",
    body: "Tell us the states you serve and we rank you first for nearby pickups.",
  },
  {
    icon: BadgeCheck,
    title: "A verified-only network",
    body: "We check every shipper's FMC license, bond and cargo insurance, and show buyers an \"Insured\" badge. Serious operators only.",
  },
  {
    icon: Receipt,
    title: "Buyers who know the costs",
    body: "Buyers see shipping estimates upfront, so quotes aren't a surprise.",
  },
];

/**
 * Public shipper landing page. The signed-in shipper portal (rates, card on
 * file) lives at /shipper/portal; "Shipper sign in" goes there, and it
 * sends signed-out visitors to login first.
 */
export default function ShipperLandingPage() {
  const wa = whatsappLink();
  return (
    <main className="min-h-screen bg-white">
      <section className="bg-black text-white">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
            Ship with ShipMova
          </h1>
          <p className="mt-4 max-w-xl text-gray-300">
            Verified cars, paid-up buyers and clean paperwork, ready to move.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/shipper/signup"
              className="inline-flex h-13 items-center justify-center rounded bg-white px-7 text-lg font-medium text-black hover:bg-gray-200"
            >
              Apply to ship with us &rarr;
            </Link>
            <Link
              href="/shipper/portal"
              className="inline-flex h-13 items-center justify-center rounded border border-white px-7 text-lg font-medium text-white hover:bg-white/10"
            >
              Shipper sign in
            </Link>
          </div>
        </div>
      </section>

      <BenefitsSection
        benefits={SHIPPER_BENEFITS}
      >
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link href="/shipper/signup" className={buttonClasses({ size: "lg" })}>
            Apply to ship with us &rarr;
          </Link>
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="text-sm text-black underline underline-offset-4">
              Questions? WhatsApp us
            </a>
          ) : null}
        </div>
      </BenefitsSection>
    </main>
  );
}
