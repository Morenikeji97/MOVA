import type { Metadata } from "next";
import Link from "next/link";
import {
  Search,
  Bookmark,
  Truck,
  CreditCard,
  Phone,
  Handshake,
  Ship,
  Star,
  ShieldCheck,
  FileCheck,
  ShieldAlert,
  MessageSquareQuote,
} from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { BUYER_PROTECTION_POLICY_PATH } from "@/lib/policy";

export const metadata: Metadata = {
  title: "How MOVA Works — MOVA",
  description:
    "A plain-language walkthrough of how MOVA connects verified U.S. sellers with international buyers, from browsing a listing to the car arriving at your door.",
};

const STEPS = [
  {
    icon: Search,
    title: "Browse verified listings",
    body: "Every vehicle on MOVA has been reviewed by our team — VIN checked, title checked, seller identity verified — before it's ever shown to buyers.",
  },
  {
    icon: Bookmark,
    title: "Reserve the one you want",
    body: "Reserving costs nothing and doesn't obligate you to buy. It just tells us — and the seller — that you're seriously interested, so we can start the process.",
  },
  {
    icon: Truck,
    title: "Choose your shipper and destination",
    body: "Pick from vetted shipping partners and get an upfront shipping quote for your route before you pay anything to MOVA.",
  },
  {
    icon: CreditCard,
    title: "Pay MOVA's facilitation fee",
    body: "This is a small, disclosed fee for the verification and coordination work MOVA has done — not payment for the car itself. More on exactly what this covers below.",
  },
  {
    icon: Phone,
    title: "Get the seller's contact details",
    body: "Once the fee is paid, we connect you directly with the seller — phone, email, WhatsApp, whichever they've provided — so you can talk the same way you would with anyone else.",
  },
  {
    icon: Handshake,
    title: "Arrange the purchase directly with the seller",
    body: "You and the seller agree on the final details and handle the vehicle payment between yourselves, seller to buyer, just like any private car sale.",
  },
  {
    icon: Ship,
    title: "Your shipper handles pickup and delivery",
    body: "Once you and the seller have a deal, your chosen shipper picks up the vehicle and takes care of the entire journey to your destination port.",
  },
  {
    icon: Star,
    title: "Leave a review",
    body: "After it's all done, you can rate the seller and the shipper — helping the next buyer make a confident decision, the same way your review of a listing helped guide you.",
  },
];

const TRUST_POINTS = [
  {
    icon: ShieldCheck,
    title: "Every seller is identity-verified",
    body: "We confirm who a seller actually is before their listing ever goes live — not just an email address.",
  },
  {
    icon: FileCheck,
    title: "Every VIN and title is checked",
    body: "Our team manually verifies VIN and title status against national records before approving a listing, so “the car in the photos” is the car you're actually buying.",
  },
  {
    icon: ShieldAlert,
    title: "You're protected if something's misrepresented",
    body: "If a vehicle turns out to be materially different from what was listed — wrong VIN, undisclosed damage, a title issue — our Buyer Protection Policy entitles you to a full refund of the facilitation fee.",
  },
  {
    icon: MessageSquareQuote,
    title: "Real reviews from real buyers",
    body: "Sellers and shippers build a track record over time, so you're never deciding on trust alone.",
  },
];

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="bg-black text-white">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            How MOVA works
          </h1>
          <p className="mt-4 max-w-xl text-gray-300">
            Buying a car from another country can feel risky. Here&rsquo;s
            exactly how MOVA makes it safe, transparent, and simple — from
            browsing a listing to the car arriving at your door.
          </p>
        </div>
      </section>

      {/* Section 1 — the journey, step by step */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="font-mono text-xs uppercase tracking-wider text-gray-500">
          The journey, step by step
        </h2>
        <ol className="mt-6 flex flex-col gap-4">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="flex gap-4 rounded-lg border border-gray-200 bg-white p-5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-black">
                <step.icon className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-gray-500">
                  Step {i + 1}
                </p>
                <h3 className="mt-1 font-semibold text-black">{step.title}</h3>
                <p className="mt-1 text-sm text-gray-500">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Section 2 — fee structure */}
      <section className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <h2 className="font-mono text-xs uppercase tracking-wider text-gray-500">
            What you actually pay for
          </h2>
          <p className="mt-3 max-w-2xl text-gray-500">
            Buying internationally shouldn&rsquo;t come with surprise costs.
            Every dollar is shown to you before you pay anything. Here&rsquo;s
            a real example:
          </p>

          <dl className="mt-6 max-w-md rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between py-2 text-sm">
              <dt className="text-gray-500">Vehicle price</dt>
              <dd className="font-mono text-black">{usd.format(25000)}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-gray-200 py-2 text-sm">
              <dt className="text-gray-500">MOVA facilitation fee (8%)</dt>
              <dd className="font-mono text-black">{usd.format(2000)}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-gray-200 py-2 text-sm">
              <dt className="text-gray-500">Shipping (varies by route)</dt>
              <dd className="font-mono text-black">{usd.format(2500)}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-gray-200 pt-3 text-base font-semibold">
              <dt className="text-black">Total shown to you upfront</dt>
              <dd className="font-mono text-black">{usd.format(29500)}</dd>
            </div>
          </dl>

          <p className="mt-6 max-w-2xl text-sm text-gray-500">
            The <strong className="text-black">facilitation fee</strong> and
            the <strong className="text-black">shipping cost</strong> are two
            separate things, paid separately, with separate refund rules —
            we&rsquo;re never bundling costs to hide what you&rsquo;re actually
            paying for. Full detail in our{" "}
            <Link
              href={BUYER_PROTECTION_POLICY_PATH}
              className="text-black underline underline-offset-2"
            >
              Buyer Protection &amp; Refund Policy
            </Link>
            .
          </p>
        </div>
      </section>

      {/* Section 3 — what MOVA is and isn't */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="font-mono text-xs uppercase tracking-wider text-gray-500">
          What MOVA is (and isn&rsquo;t)
        </h2>
        <p className="mt-3 max-w-2xl text-gray-500">
          We&rsquo;re straightforward about our role, because trust starts
          with clarity.
        </p>
        <div className="mt-6 max-w-2xl rounded-lg border border-gray-200 bg-white p-6 text-sm text-black">
          <p>
            MOVA is a <strong>technology platform</strong> — we verify
            sellers, check listings, and give buyers and sellers the tools to
            connect and pay safely.
          </p>
          <p className="mt-3">
            What MOVA is <em>not</em>: we&rsquo;re not the seller of any
            vehicle, we&rsquo;re never a party to the sale itself, and we
            never take ownership of a vehicle at any point. The sale is
            always a direct agreement between you and the seller; shipping is
            always a direct agreement between you and your shipper.
          </p>
          <p className="mt-3">
            We charge one clear fee for the verification and coordination
            work we do — never a markup on the car.
          </p>
        </div>
      </section>

      {/* Section 4 — trust and safety */}
      <section className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <h2 className="font-mono text-xs uppercase tracking-wider text-gray-500">
            Why this is safer than going it alone
          </h2>
          <p className="mt-3 max-w-2xl text-gray-500">
            Buying a car sight-unseen from another country is exactly the
            kind of transaction scammers target. Here&rsquo;s what stands
            between you and that risk:
          </p>
          <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {TRUST_POINTS.map((point) => (
              <li
                key={point.title}
                className="rounded-lg border border-gray-200 bg-white p-5"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-black">
                  <point.icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="mt-3 font-semibold text-black">
                  {point.title}
                </h3>
                <p className="mt-1 text-sm text-gray-500">{point.body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-2xl text-sm text-gray-500">
            Put together, this is a level of upfront verification you simply
            don&rsquo;t get buying from an anonymous listing site or wiring
            money to a stranger you found online.
          </p>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h2 className="text-2xl font-semibold text-black">
          Ready to see what&rsquo;s available?
        </h2>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/browse" className={buttonClasses({ variant: "primary", size: "lg" })}>
            Browse Vehicles
          </Link>
          <Link
            href={BUYER_PROTECTION_POLICY_PATH}
            className={buttonClasses({ variant: "secondary", size: "lg" })}
          >
            Read the Buyer Protection Policy
          </Link>
        </div>
      </section>
    </main>
  );
}
