import type { Metadata } from "next";
import Link from "next/link";
import {
  Search,
  Bookmark,
  Truck,
  CreditCard,
  ClipboardCheck,
  Anchor,
  Ship,
  Star,
  ShieldCheck,
  FileCheck,
  ShieldAlert,
  MessageSquareQuote,
} from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { BUYER_PROTECTION_POLICY_PATH } from "@/lib/policy";
import { feeBreakdown } from "@/lib/fees";
import { isPrelaunch } from "@/lib/prelaunch";
import { WaitlistForm } from "@/components/ui/waitlist-form";

export const metadata: Metadata = {
  title: "How MOVA Works — MOVA",
  description:
    "How buying a car on MOVA works: verified U.S. sellers, your payment held by Escrow.com, and an inspection before the seller is paid.",
};

const STEPS = [
  {
    icon: Search,
    title: "Find a car.",
    body: "Every listing shows whether it can be imported to your country and an estimated total cost.",
  },
  {
    icon: Bookmark,
    title: "Reserve it.",
    body: "Free, no obligation.",
  },
  {
    icon: Truck,
    title: "Choose a shipper and get your shipping quote upfront.",
    body: "Each quote shows whether clearing at your port is included.",
  },
  {
    icon: CreditCard,
    title: "Pay MOVA's fee, then the car price into escrow.",
    body: "",
  },
  {
    icon: ClipboardCheck,
    title: "Inspection and pickup.",
    body: "An independent inspector checks the car; your shipper collects it with the original title.",
  },
  {
    icon: Ship,
    title: "The seller gets paid and your car ships.",
    body: "",
  },
  {
    icon: Anchor,
    title: "Clear it at your port.",
    body: "If your shipper includes clearing, they handle it; if not, use your own clearing agent or one we recommend.",
  },
  {
    icon: Star,
    title: "Review the seller and the shipper.",
    body: "",
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

// Worked example, computed by the same function every listing uses.
const EXAMPLE = feeBreakdown(25_000, "buyer_pays_full");
const EXAMPLE_SHIPPING = 2_500;

function ExampleRow({
  label,
  value,
  first = false,
  strong = false,
}: {
  label: string;
  value: number;
  first?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={
        (first ? "" : "border-t border-gray-200 ") +
        "flex items-center justify-between py-2 " +
        (strong ? "text-base font-semibold" : "text-sm")
      }
    >
      <dt className={strong ? "text-black" : "text-gray-500"}>{label}</dt>
      <dd className="font-mono text-black">{usd.format(value)}</dd>
    </div>
  );
}

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
                {step.body ? <p className="mt-1 text-sm text-gray-500">{step.body}</p> : null}
              </div>
            </li>
          ))}
        </ol>
        {isPrelaunch() ? <WaitlistForm source="how_it_works" className="mt-8" /> : null}
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
            <ExampleRow label="Car price" value={EXAMPLE.vehiclePrice} first />
            <ExampleRow label="MOVA fee (8%)" value={EXAMPLE.buyerFee} />
            <ExampleRow label="Escrow.com fee (est.)" value={EXAMPLE.escrowFee ?? 0} />
            <ExampleRow label="Total before shipping" value={EXAMPLE.totalBeforeShipping} strong />
            <ExampleRow label="Shipping (varies by route)" value={EXAMPLE_SHIPPING} />
            <ExampleRow
              label="Total shown to you upfront"
              value={EXAMPLE.totalBeforeShipping + EXAMPLE_SHIPPING}
              strong
            />
          </dl>

          <p className="mt-6 max-w-2xl text-sm text-gray-500">
            <strong className="text-black">MOVA&rsquo;s fee</strong>, the{" "}
            <strong className="text-black">car price</strong> (held by
            Escrow.com), Escrow.com&rsquo;s own fee and the{" "}
            <strong className="text-black">shipping cost</strong> are separate
            lines, paid separately, with separate refund rules — we&rsquo;re
            never bundling costs to hide what you&rsquo;re actually paying for.
            On listings marked &ldquo;Seller splits the fee&rdquo; you pay 4%
            instead of 8%. Full detail in our{" "}
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
            sellers, check listings, and coordinate a protected payment: the
            car price is held by Escrow.com, a licensed escrow company, and
            only released to the seller after inspection and pickup.
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
