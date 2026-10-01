import type { Metadata } from "next";
import Link from "next/link";
import { BadgeDollarSign, Banknote, Globe2, ShieldCheck, SlidersHorizontal, Truck } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { BenefitsSection, type Benefit } from "@/components/ui/benefits-section";
import { WaitlistForm } from "@/components/ui/waitlist-form";
import { isPrelaunch } from "@/lib/prelaunch";

export const metadata: Metadata = {
  title: "Sell your car — ShipMova",
  description:
    "Reach verified international buyers without handling export paperwork, shipping or overseas payments yourself.",
};

const SELLER_BENEFITS: Benefit[] = [
  {
    icon: Globe2,
    title: "A bigger market for your car",
    body: "Buyers in Nigeria, Ghana, Togo and Benin are looking for U.S. cars like yours.",
  },
  {
    icon: Banknote,
    title: "Paid at pickup, not at arrival",
    body: "Escrow.com pays you once the inspector confirms your car and a licensed shipper collects it with the title. No waiting for it to cross the ocean.",
  },
  {
    icon: ShieldCheck,
    title: "No overseas payment risk",
    body: "Buyers pay into escrow. You never handle foreign transfers, fake checks or overpayment scams.",
  },
  {
    icon: Truck,
    title: "We handle the hard parts",
    body: "A licensed, insured shipper picks up the car and handles export paperwork and the port.",
  },
  {
    icon: BadgeDollarSign,
    title: "Free to list",
    body: "Buyers pay ShipMova's fee. Want to stand out? Offer to split it 50/50, deducted from your payout.",
  },
  {
    icon: SlidersHorizontal,
    title: "You stay in control",
    body: "Set your price, offer a buyer a lower price, and remove your listing anytime before a buyer commits.",
  },
];

const FAQ = [
  {
    q: "Do I ship the car myself?",
    a: "No. A licensed, insured shipper picks it up from you.",
  },
  {
    q: "When do I get paid?",
    a: "When the shipper collects the car and original title, after inspection.",
  },
  {
    q: "Can buyers negotiate?",
    a: "Yes. You can propose a lower price; the buyer must accept it.",
  },
  {
    q: "Does ShipMova take ownership of my car?",
    a: "Never. You sell directly to the buyer; ShipMova provides the verification and payment tools.",
  },
  {
    q: "What happens to my title?",
    a: "You hand the original title to the shipper at pickup. U.S. Customs requires it for export.",
  },
  {
    q: "Can I remove my listing?",
    a: "Anytime, unless a buyer is mid-purchase.",
  },
  {
    q: "What cars qualify?",
    a: "Cars the buyer's country allows in — for Nigeria, roughly 2014 and newer. We check automatically.",
  },
];

/**
 * Seller landing page — the "Sell Your Car" nav target. The listing form
 * itself stays at /seller/listings/new (sign-in required); this page is
 * public.
 */
export default function SellPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="bg-black text-white">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
            Sell your car to buyers beyond the U.S.
          </h1>
          <p className="mt-4 max-w-xl text-gray-300">
            Reach verified international buyers without handling export
            paperwork, shipping or overseas payments yourself.
          </p>
          <Link
            href="/seller/listings/new"
            className="mt-8 inline-flex h-13 items-center justify-center rounded bg-white px-7 text-lg font-medium text-black hover:bg-gray-200"
          >
            List your car &rarr;
          </Link>
        </div>
      </section>

      {isPrelaunch() ? (
        <section className="border-b border-gray-200 bg-gray-100">
          <div className="mx-auto max-w-4xl px-6 py-10">
            <WaitlistForm source="sell" audience="seller" />
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="text-2xl font-semibold text-black">How you get paid</h2>
        <p className="mt-3 max-w-2xl text-gray-500">
          The buyer&rsquo;s money is held by Escrow.com before your car leaves.
          You&rsquo;re paid as soon as an inspector confirms your car and a
          licensed shipper picks it up with the title — no waiting for it to
          cross the ocean.
        </p>

        <h2 className="mt-12 text-2xl font-semibold text-black">Fees</h2>
        <p className="mt-3 max-w-2xl text-gray-500">
          Listing is free. Buyers pay ShipMova&rsquo;s fee. Want your car to stand
          out? Offer to split it 50/50 — your half is simply deducted from your
          payout. Nothing to pay upfront.
        </p>
      </section>

      <BenefitsSection
        headline="Why sell with ShipMova?"
        subhead="Reach buyers across West Africa without the export headache."
        benefits={SELLER_BENEFITS}
      >
        <Link href="/seller/listings/new" className={buttonClasses({ size: "lg", className: "mt-8" })}>
          List your car &rarr;
        </Link>
      </BenefitsSection>

      <section className="border-t border-gray-200">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <h2 className="text-2xl font-semibold text-black">FAQ</h2>
          <dl className="mt-6 flex flex-col gap-4">
            {FAQ.map((item) => (
              <div key={item.q} className="rounded-lg border border-gray-200 bg-white p-5">
                <dt className="font-semibold text-black">{item.q}</dt>
                <dd className="mt-1 text-sm text-gray-500">{item.a}</dd>
              </div>
            ))}
          </dl>
          <Link
            href="/seller/listings/new"
            className={buttonClasses({ size: "lg", className: "mt-10" })}
          >
            List your car &rarr;
          </Link>
        </div>
      </section>
    </main>
  );
}
