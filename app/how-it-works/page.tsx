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
import { cardClasses } from "@/components/ui/card";
import { PageHero, SectionHeading } from "@/components/ui/page-hero";
import { BUYER_PROTECTION_POLICY_PATH } from "@/lib/policy";
import { feeBreakdown } from "@/lib/fees";
import { isPrelaunch } from "@/lib/prelaunch";
import { WaitlistForm } from "@/components/ui/waitlist-form";
import { WhyBuy } from "@/components/ui/why-buy";

export const metadata: Metadata = {
  title: "How ShipMova Works — ShipMova",
  description:
    "How buying a car on ShipMova works: verified U.S. sellers, your payment held by Escrow.com, and an inspection before the seller is paid.",
};

const STEPS = [
  {
    icon: Search,
    title: "Find a car.",
    body: "Every listing shows whether it can be imported to Nigeria (more countries coming) and an estimated total cost.",
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
    title: "Pay ShipMova's fee, then the car price into escrow.",
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
        (first ? "" : "border-t border-line ") +
        "flex items-center justify-between py-2 " +
        (strong ? "text-base font-semibold" : "text-sm")
      }
    >
      <dt className={strong ? "text-ink" : "text-muted"}>{label}</dt>
      <dd className="tabular-nums text-ink">{usd.format(value)}</dd>
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-white">
      <PageHero
        narrow
        eyebrow="How it works"
        title="How ShipMova works"
        intro="Buying a car from another country can feel risky. Here’s exactly how ShipMova makes it safe, transparent, and simple — from browsing a listing to the car arriving at your door."
      />

      {/* Section 1 — the journey, step by step */}
      {/* #shipping: the homepage's "About shipping to West Africa" card links here. */}
      <section id="shipping" className="mx-auto max-w-4xl scroll-mt-4 px-4 py-14 sm:px-6 sm:py-20">
        <SectionHeading title="The journey, step by step" />
        <ol className="mt-8 flex flex-col gap-3">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className={cardClasses({ className: "flex gap-4" })}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-band text-ink">
                <step.icon className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  Step {i + 1}
                </p>
                <h3 className="mt-1 font-display text-lg font-bold text-ink">{step.title}</h3>
                {step.body ? <p className="mt-1 text-sm text-muted">{step.body}</p> : null}
              </div>
            </li>
          ))}
        </ol>
        {isPrelaunch() ? (
          <div id="waitlist" className="scroll-mt-4">
            <WaitlistForm source="how_it_works" className="mt-8" />
          </div>
        ) : null}
      </section>

      <WhyBuy waitlistHref={isPrelaunch() ? "#waitlist" : null} />

      {/* Section 2 — fee structure */}
      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
          <SectionHeading
            title="What you actually pay for"
            intro="Buying internationally shouldn’t come with surprise costs. Every dollar is shown to you before you pay anything. Here’s a real example:"
          />

          <dl className={cardClasses({ className: "mt-8 max-w-md" })}>
            <ExampleRow label="Car price" value={EXAMPLE.vehiclePrice} first />
            <ExampleRow label="ShipMova fee (8%)" value={EXAMPLE.buyerFee} />
            <ExampleRow label="Escrow.com fee (est.)" value={EXAMPLE.escrowFee ?? 0} />
            <ExampleRow label="Total before shipping" value={EXAMPLE.totalBeforeShipping} strong />
            <ExampleRow label="Shipping (varies by route)" value={EXAMPLE_SHIPPING} />
            <ExampleRow
              label="Total shown to you upfront"
              value={EXAMPLE.totalBeforeShipping + EXAMPLE_SHIPPING}
              strong
            />
          </dl>

          <p className="mt-6 max-w-2xl text-sm text-muted">
            <strong className="text-ink">ShipMova&rsquo;s fee</strong>, the{" "}
            <strong className="text-ink">car price</strong> (held by
            Escrow.com), Escrow.com&rsquo;s own fee and the{" "}
            <strong className="text-ink">shipping cost</strong> are separate
            lines, paid separately, with separate refund rules — we&rsquo;re
            never bundling costs to hide what you&rsquo;re actually paying for.
            On listings marked &ldquo;Seller splits the fee&rdquo; you pay 4%
            instead of 8%. Full detail in our{" "}
            <Link
              href={BUYER_PROTECTION_POLICY_PATH}
              className="text-ink underline underline-offset-2"
            >
              Buyer Protection &amp; Refund Policy
            </Link>
            .
          </p>
        </div>
      </section>

      {/* Section 3 — what ShipMova is and isn't */}
      <section className="bg-band">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
        <SectionHeading
          title="What ShipMova is (and isn’t)"
          intro="We’re straightforward about our role, because trust starts with clarity."
        />
        <div className={cardClasses({ className: "mt-8 max-w-2xl text-sm text-ink" })}>
          <p>
            ShipMova is a <strong>technology platform</strong> — we verify
            sellers, check listings, and coordinate a protected payment: the
            car price is held by Escrow.com, a licensed escrow company, and
            only released to the seller after inspection and pickup.
          </p>
          <p className="mt-3">
            What ShipMova is <em>not</em>: we&rsquo;re not the seller of any
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
        </div>
      </section>

      {/* Section 4 — trust and safety */}
      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
          <SectionHeading
            title="Why this is safer than going it alone"
            intro="Buying a car sight-unseen from another country is exactly the kind of transaction scammers target. Here’s what stands between you and that risk:"
          />
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {TRUST_POINTS.map((point) => (
              <li
                key={point.title}
                className={cardClasses()}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-band text-ink">
                  <point.icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="mt-3 font-display text-lg font-bold text-ink">
                  {point.title}
                </h3>
                <p className="mt-1 text-sm text-muted">{point.body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-2xl text-sm text-muted">
            Put together, this is a level of upfront verification you simply
            don&rsquo;t get buying from an anonymous listing site or wiring
            money to a stranger you found online.
          </p>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20">
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink">
          Ready to see what&rsquo;s available?
        </h2>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link href="/browse" className={buttonClasses({ variant: "primary" })}>
            Browse Vehicles
          </Link>
          <Link
            href={BUYER_PROTECTION_POLICY_PATH}
            className={buttonClasses({ variant: "secondary" })}
          >
            Read the Buyer Protection Policy
          </Link>
        </div>
        </div>
      </section>
    </main>
  );
}
