import Link from "next/link";
import {
  Check,
  ClipboardCheck,
  FileCheck,
  HelpCircle,
  Home,
  MessageCircle,
  Receipt,
  ShieldCheck,
  X,
} from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { BenefitsSection, type Benefit } from "@/components/ui/benefits-section";

const BUYER_BENEFITS: Benefit[] = [
  {
    icon: ShieldCheck,
    title: "Your money is protected",
    body: "The car price is held by Escrow.com and only paid to the seller after the car is inspected and in your shipper's hands with the title. You never wire a stranger.",
  },
  {
    icon: FileCheck,
    title: "Real cars, real owners",
    body: "Every seller's ID is verified, the name on the title must match, and the VIN is checked against U.S. records before a listing goes live.",
  },
  {
    icon: Home,
    title: "Know it can come home",
    body: "Every listing shows whether the car can legally be imported to Nigeria (more countries coming)",
  },
  {
    icon: Receipt,
    title: "No surprise costs",
    body: "Car price, ShipMova fee, escrow fee and a shipping estimate, shown upfront.",
  },
  {
    icon: ClipboardCheck,
    title: "Someone checks the car for you",
    body: "An independent inspector verifies the VIN, mileage, title and condition in person before pickup.",
  },
  {
    icon: MessageCircle,
    title: "Buy direct from the owner",
    body: "U.S. owner prices, one clear fee, and a real person on WhatsApp.",
  },
];

type Mark = "yes" | "no" | "unsure" | string;

const COMPARISON: { label: string; shipmova: Mark; alone: Mark }[] = [
  { label: "Who holds your money", shipmova: "Licensed escrow", alone: "You wire the seller" },
  { label: "Seller identity verified", shipmova: "yes", alone: "unsure" },
  { label: "Title matched to seller", shipmova: "yes", alone: "unsure" },
  { label: "Car inspected in person before shipping", shipmova: "yes", alone: "no" },
  { label: "Import eligibility checked (Nigeria)", shipmova: "yes", alone: "unsure" },
  { label: "Full cost shown upfront", shipmova: "yes", alone: "no" },
];

function Cell({ value }: { value: Mark }) {
  if (value === "yes") {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-verified-600">
        <Check className="h-4 w-4" aria-hidden /> <span className="sr-only">Yes</span>
      </span>
    );
  }
  if (value === "no") {
    return (
      <span className="inline-flex items-center gap-1 text-copper-700">
        <X className="h-4 w-4" aria-hidden /> <span className="sr-only">No</span>
      </span>
    );
  }
  if (value === "unsure") {
    return (
      <span className="inline-flex items-center gap-1 text-gray-500">
        <HelpCircle className="h-4 w-4" aria-hidden /> <span className="sr-only">Not known</span>
      </span>
    );
  }
  return <span className="text-sm text-black">{value}</span>;
}

/**
 * "Why buy with ShipMova?" — the buyer benefits, the "ShipMova vs. buying
 * on your own" table, and the CTAs. On the homepage (after the hero) and
 * on /how-it-works.
 */
export function WhyBuy({ waitlistHref = null }: { waitlistHref?: string | null }) {
  return (
    <BenefitsSection
      id="why-shipmova"
      headline="Why buy with ShipMova?"
      subhead="Buying a car from America shouldn't mean trusting a stranger with your savings."
      benefits={BUYER_BENEFITS}
    >
      {/* relative: keeps the cells' sr-only labels inside the scroll box, so the page itself never scrolls sideways at 320px. */}
      <div className="relative mt-10 overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-left text-sm">
          <caption className="mb-3 text-left text-lg font-semibold text-black">
            ShipMova vs. buying on your own
          </caption>
          <thead>
            <tr className="border-b border-gray-200">
              <th scope="col" className="py-2 pr-4 font-medium text-gray-500">
                <span className="sr-only">What matters</span>
              </th>
              <th scope="col" className="py-2 pr-4 font-semibold text-black">ShipMova</th>
              <th scope="col" className="py-2 font-semibold text-black">On your own</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map((row) => (
              <tr key={row.label} className="border-b border-gray-200">
                <th scope="row" className="py-3 pr-4 font-normal text-black">{row.label}</th>
                <td className="py-3 pr-4"><Cell value={row.shipmova} /></td>
                <td className="py-3"><Cell value={row.alone} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/browse" className={buttonClasses({ size: "lg" })}>
          Browse cars &rarr;
        </Link>
        {waitlistHref ? (
          <Link href={waitlistHref} className={buttonClasses({ size: "lg", variant: "secondary" })}>
            Join the waitlist
          </Link>
        ) : null}
      </div>
    </BenefitsSection>
  );
}
