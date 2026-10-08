import Link from "next/link";
import { preload } from "react-dom";
import { createClient } from "@/lib/supabase/server";
import { buttonClasses } from "@/components/ui/button";
import { cardClasses } from "@/components/ui/card";
import { VehicleCard } from "@/components/ui/vehicle-card";
import { loadRecentApprovedListings } from "@/lib/listings";
import { getFxRates } from "@/lib/fx";
import { getDisplayCurrency } from "@/lib/display-currency-server";
import { cardCurrencies } from "@/lib/display-currency";
import { FxNote } from "@/components/ui/fx-note";
import { SELLER_SPLITS_FEE_BADGE } from "@/lib/fees";
import { isPrelaunch } from "@/lib/prelaunch";
import { WaitlistForm } from "@/components/ui/waitlist-form";
import { WhyBuy } from "@/components/ui/why-buy";
import { CATEGORY_CHIPS } from "@/lib/browse-filters";
import { HOME_IMAGES } from "@/lib/home-images";
import { inputClasses } from "@/components/ui/input-classes";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  ClipboardCheckIcon,
  DocumentCheckIcon,
  LockIcon,
  SearchIcon,
  ShieldCheckIcon,
  ShipIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const TRUST_ROW = [
  { icon: ShieldCheckIcon, label: "Verified Sellers" },
  { icon: DocumentCheckIcon, label: "Title Checked" },
  { icon: ClipboardCheckIcon, label: "Independent Inspections" },
  { icon: LockIcon, label: "Payments held by Escrow.com" },
  { icon: ShipIcon, label: "Multiple Shipping Options" },
];

const ROLE_CARDS = [
  {
    title: "Buy a Vehicle",
    body: "Find verified U.S. vehicles and get them shipped to West Africa.",
    cta: "Browse Cars",
    href: "/browse",
    image: HOME_IMAGES.roleBuy,
  },
  {
    title: "Sell Your Vehicle",
    body: "Reach ID-verified buyers in Nigeria, Ghana, Togo and Benin.",
    cta: "List Your Car",
    href: "/sell",
    image: HOME_IMAGES.roleSell,
  },
  {
    title: "Become a Shipper",
    body: "Get vehicle shipping jobs to West Africa. No fees for founding partners.",
    cta: "Join as a Shipper",
    href: "/shipper",
    image: HOME_IMAGES.roleShipper,
  },
  {
    title: "Become an Inspector",
    body: "Earn from in-person inspections and join a trusted network.",
    cta: "Join as an Inspector",
    href: "/inspectors",
    image: HOME_IMAGES.roleInspector,
  },
];

// The journey in four steps — a summary of /how-it-works, same wording.
const HOW_STEPS = [
  { title: "Find a car", body: "Every listing shows whether it can be imported to Nigeria (more countries coming) and an estimated total cost." },
  { title: "Reserve it", body: "Free, no obligation. Choose a shipper and get your shipping quote upfront." },
  { title: "Pay into escrow", body: "Pay ShipMova's fee, then the car price into Escrow.com — not to the seller." },
  { title: "Inspection, pickup, shipping", body: "An independent inspector checks the car; your shipper collects it with the original title; then the seller is paid and your car ships." },
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
    body: "we flag cars that can't legally enter Nigeria before you pay anything (more countries coming).",
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

// Shown in the make dropdown when nothing is listed yet, so the search bar
// still works (it just finds nothing until cars are listed).
const COMMON_MAKES = [
  "Acura", "BMW", "Chevrolet", "Dodge", "Ford", "GMC", "Honda", "Hyundai", "Jeep", "Kia",
  "Lexus", "Mazda", "Mercedes-Benz", "Nissan", "Ram", "Subaru", "Tesla", "Toyota", "Volkswagen",
];

function SectionHeading({ eyebrow, title, intro }: { eyebrow?: string; title: string; intro?: string }) {
  return (
    <div className="max-w-2xl">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{eyebrow}</p>
      ) : null}
      <h2 className={cn("font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl", eyebrow && "mt-2")}>
        {title}
      </h2>
      {intro ? <p className="mt-3 text-muted">{intro}</p> : null}
    </div>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const [{ rows: listings, thumbByVehicle }, fx, { data: makeRows }, currency] = await Promise.all([
    loadRecentApprovedListings(supabase, 8),
    getFxRates(),
    // Makes in the approved inventory, for the search bar (same as /browse).
    supabase.from("vehicles").select("make").eq("status", "approved").order("make", { ascending: true }),
    getDisplayCurrency(),
  ]);
  const listedMakes = [...new Set((makeRows ?? []).map((r) => r.make))];
  const makes = listedMakes.length > 0 ? listedMakes : COMMON_MAKES;
  const localCurrencies = cardCurrencies(currency);
  const prelaunch = isPrelaunch();

  // The hero photo is the largest thing on the page: fetch it first.
  preload(HOME_IMAGES.heroPhone.src, { as: "image", fetchPriority: "high", media: "(max-width: 767px)" });
  preload(HOME_IMAGES.heroDesktop.src, { as: "image", fetchPriority: "high", media: "(min-width: 768px)" });

  return (
    <main className="min-h-screen bg-white">
      {/* ---------------- Hero ---------------- */}
      <section className="relative isolate overflow-hidden bg-ink text-white">
        <picture>
          <source media="(min-width: 768px)" srcSet={HOME_IMAGES.heroDesktop.src} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={HOME_IMAGES.heroPhone.src}
            alt=""
            width={HOME_IMAGES.heroPhone.width}
            height={HOME_IMAGES.heroPhone.height}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 -z-20 h-full w-full object-cover opacity-50 md:left-auto md:right-0 md:w-[64%] md:opacity-100"
          />
        </picture>
        {/* Fades the photo into black on the left and bottom (desktop). */}
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 -z-10 hidden w-[64%] bg-gradient-to-r from-ink via-ink/40 to-transparent md:block"
        />
        <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-1/3 bg-gradient-to-t from-ink to-transparent" />

        <div className="mx-auto max-w-6xl px-4 pb-14 pt-14 sm:px-6 md:pb-24 md:pt-20">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">
            Trusted. Transparent. Global.
          </p>
          <h1 className="mt-4 max-w-5xl font-display text-[40px] font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-[72px]">
            Quality Vehicles
            <br />
            From the U.S. to <span className="whitespace-nowrap text-[#BDBDBD]">West Africa.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-white/80 sm:text-lg">
            Browse, inspect, and ship with confidence on a trusted U.S.–West Africa vehicle marketplace.
          </p>

          <form
            action="/browse"
            method="get"
            role="search"
            className="mt-8 flex max-w-3xl flex-col gap-2 rounded-card bg-white p-2 text-ink shadow-card sm:flex-row sm:items-center"
          >
            <label className="relative flex items-center sm:w-48">
              <span className="sr-only">Make</span>
              <select
                name="make"
                defaultValue=""
                className={inputClasses({ className: "w-full appearance-none pr-9" })}
              >
                <option value="">Any make</option>
                {makes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <ChevronDownIcon size={18} className="pointer-events-none absolute right-3 text-muted" />
            </label>
            <label className="flex-1">
              <span className="sr-only">Keyword</span>
              <input
                type="search"
                name="q"
                placeholder="Model, trim or keyword"
                maxLength={80}
                enterKeyHint="search"
                autoComplete="off"
                className={inputClasses({ className: "w-full" })}
              />
            </label>
            <button type="submit" className={buttonClasses({ className: "w-full sm:w-auto" })}>
              <SearchIcon size={18} />
              Search
            </button>
          </form>

          <ul aria-label="Browse by category" className="mt-4 flex flex-wrap gap-2">
            {CATEGORY_CHIPS.map((chip) => (
              <li key={chip.href}>
                <Link
                  href={chip.href}
                  className="flex h-11 items-center rounded-full border border-white/30 px-4 text-sm font-medium text-white hover:border-white hover:bg-white/10"
                >
                  {chip.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <Link
          href="/how-it-works#shipping"
          className="absolute bottom-8 right-8 hidden w-72 rounded-card border border-white/15 bg-ink/70 p-5 backdrop-blur hover:border-white/40 lg:block"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Learn more</p>
          <p className="mt-1 flex items-center justify-between gap-3 font-display text-lg font-bold">
            About shipping to West Africa
            <ArrowRightIcon size={20} />
          </p>
        </Link>
      </section>

      {/* ---------------- Trust row ---------------- */}
      <section className="border-b border-line bg-white">
        <ul className="mx-auto grid max-w-6xl grid-cols-1 gap-x-6 gap-y-3 px-4 py-6 text-sm font-semibold text-ink sm:grid-cols-2 sm:px-6 lg:grid-cols-5">
          {TRUST_ROW.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-band">
                <Icon size={18} />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------- Role cards ---------------- */}
      <section className="bg-band">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <SectionHeading title="How will you use ShipMova?" />
          <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ROLE_CARDS.map((card) => (
              <li key={card.title} className={cardClasses({ padded: false, className: "flex flex-col overflow-hidden" })}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={card.image.src}
                  alt=""
                  width={card.image.width}
                  height={card.image.height}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[8/5] w-full object-cover"
                />
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-display text-xl font-bold text-ink">{card.title}</h3>
                  <p className="mt-2 flex-1 text-sm text-muted">{card.body}</p>
                  <Link href={card.href} className={buttonClasses({ className: "mt-5 w-full" })}>
                    {card.cta}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {prelaunch ? (
        <section id="waitlist" className="scroll-mt-4 border-b border-line bg-white">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <WaitlistForm source="home" className="max-w-3xl" />
          </div>
        </section>
      ) : null}

      {/* ---------------- Latest listings (only when there are any) ---------------- */}
      {listings.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="flex items-end justify-between gap-4">
            {/* "Latest listings", not "verified": approval is moderation, not
                verification (0032). The per-card badges say what was checked. */}
            <SectionHeading title="Latest listings" />
            <Link href="/browse" className="flex h-11 shrink-0 items-center gap-1 text-sm font-semibold text-ink hover:underline">
              Browse all <ArrowRightIcon size={16} />
            </Link>
          </div>
          <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((v) => (
              <li key={v.id}>
                <VehicleCard
                  vehicle={v}
                  thumbnailUrl={thumbByVehicle.get(v.id) ?? null}
                  fx={fx}
                  localCurrencies={localCurrencies}
                />
              </li>
            ))}
          </ul>
          <FxNote fx={fx} className="mt-4" />
        </section>
      ) : null}

      {/* ---------------- How it works ---------------- */}
      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <SectionHeading eyebrow="How it works" title="From a U.S. listing to your port" />
          <ol className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_STEPS.map((step, i) => (
              <li key={step.title} className={cardClasses()}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-display text-sm font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-display text-lg font-bold text-ink">{step.title}</h3>
                <p className="mt-1 text-sm text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
          <Link href="/how-it-works" className={buttonClasses({ variant: "secondary", className: "mt-8" })}>
            See exactly how it works <ArrowRightIcon size={18} />
          </Link>
        </div>
      </section>

      {/* ---------------- Who holds your money ---------------- */}
      <section className="bg-band">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <SectionHeading title="Who holds your money" intro="Your money never goes to a stranger." />
          <ol className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {MONEY_STEPS.map((step, i) => (
              <li key={step} className={cardClasses({ className: "flex gap-4" })}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink font-display text-sm font-bold text-white">
                  {i + 1}
                </span>
                <p className="text-sm text-ink">{step}</p>
              </li>
            ))}
          </ol>
          <div className="mt-6 max-w-2xl rounded-card border border-copper-100 bg-copper-50 p-5">
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

      {/* ---------------- What the 8% covers ---------------- */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <SectionHeading
            title="What the 8% covers"
            intro="Every car on ShipMova goes through checks you can't easily do yourself from your country:"
          />
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEE_COVERS.map((item) => (
              <li key={item.title} className={cardClasses()}>
                <p className="font-display font-bold text-ink">{item.title}</p>
                <p className="mt-1 text-sm text-muted">{item.body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-2xl text-sm text-muted">
            ShipMova&rsquo;s fee is 8% of the car price, shown before you commit. On some listings the
            seller pays half — look for the &ldquo;{SELLER_SPLITS_FEE_BADGE}&rdquo; badge. Escrow.com&rsquo;s
            fee is shown separately.
          </p>
        </div>
      </section>

      <WhyBuy waitlistHref={prelaunch ? "#waitlist" : null} />
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
