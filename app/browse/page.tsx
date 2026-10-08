import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/button";
import { VehicleCard, type VehicleCardData } from "@/components/ui/vehicle-card";
import { LISTING_CARD_COLUMNS, loadListingThumbnails } from "@/lib/listings";
import { getFxRates } from "@/lib/fx";
import { getDisplayCurrency } from "@/lib/display-currency-server";
import { cardCurrencies } from "@/lib/display-currency";
import { FxNote } from "@/components/ui/fx-note";
import { isPrelaunch } from "@/lib/prelaunch";
import { WaitlistForm } from "@/components/ui/waitlist-form";
import { inputClasses } from "@/components/ui/input-classes";
import { cardClasses } from "@/components/ui/card";
import { CarIcon, CheckIcon, ChevronDownIcon, SearchIcon } from "@/components/ui/icons";
import {
  BODY_FILTERS,
  FUEL_FILTERS,
  keywordOrFilter,
  keywordTerms,
  parseBodyFilter,
  parseFuelFilter,
} from "@/lib/browse-filters";

const inputClass = inputClasses();

/** Reads a single-value string search param, ignoring arrays and blanks. */
function str(value: string | string[] | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Reads a non-negative integer search param, or null when absent/invalid. */
function int(value: string | string[] | undefined): number | null {
  const s = str(value);
  return /^\d+$/.test(s) ? Number(s) : null;
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const make = str(sp.make);
  const minPrice = int(sp.min);
  const maxPrice = int(sp.max);
  // From the homepage search bar and category chips (lib/browse-filters.ts).
  const keyword = str(sp.q);
  const terms = keywordTerms(keyword);
  const body = parseBodyFilter(str(sp.type));
  const fuel = parseFuelFilter(str(sp.fuel));
  const category = body ? BODY_FILTERS[body].label : fuel ? FUEL_FILTERS[fuel].label : null;
  const hasFilters =
    make !== "" || minPrice !== null || maxPrice !== null || terms.length > 0 || body !== null || fuel !== null;

  const supabase = await createClient();

  // Distinct makes across the approved inventory, for the filter dropdown.
  const { data: makeRows } = await supabase
    .from("vehicles")
    .select("make")
    .eq("status", "approved")
    .order("make", { ascending: true });
  const makes = [...new Set((makeRows ?? []).map((r) => r.make))];

  let query = supabase
    .from("vehicles")
    .select(LISTING_CARD_COLUMNS)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (make) query = query.eq("make", make);
  if (minPrice !== null) query = query.gte("price_usd", minPrice);
  if (maxPrice !== null) query = query.lte("price_usd", maxPrice);
  for (const term of terms) query = query.or(keywordOrFilter(term));
  if (body) query = query.eq("vehicle_size_type", BODY_FILTERS[body].sizeType);
  if (fuel) query = query.in("fuel_type", [...FUEL_FILTERS[fuel].fuelTypes]);

  const { data: vehicles } = await query;
  const rows = (vehicles ?? []) as VehicleCardData[];

  const [thumbByVehicle, fx] = await Promise.all([
    loadListingThumbnails(
      supabase,
      rows.map((v) => v.id),
    ),
    getFxRates(),
  ]);
  const localCurrencies = cardCurrencies(await getDisplayCurrency());

  // Category chips keep the other filters; one category at a time, and
  // tapping the active one clears it (same ?type= / ?fuel= the homepage uses).
  const keep = new URLSearchParams();
  if (make) keep.set("make", make);
  if (keyword) keep.set("q", keyword);
  if (minPrice !== null) keep.set("min", String(minPrice));
  if (maxPrice !== null) keep.set("max", String(maxPrice));
  const chipHref = (param: "type" | "fuel", key: string, active: boolean) => {
    const next = new URLSearchParams(keep);
    if (!active) next.set(param, key);
    const qs = next.toString();
    return qs ? `/browse?${qs}` : "/browse";
  };
  const chips = [
    ...Object.entries(BODY_FILTERS).map(([key, f]) => ({
      label: f.label,
      active: body === key,
      href: chipHref("type", key, body === key),
    })),
    ...Object.entries(FUEL_FILTERS).map(([key, f]) => ({
      label: f.label,
      active: fuel === key,
      href: chipHref("fuel", key, fuel === key),
    })),
  ];
  const labelClass = "text-xs font-semibold uppercase tracking-[0.14em] text-muted";

  return (
    <div className="min-h-screen bg-band">
      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 pb-6 pt-10 sm:px-6 sm:pt-14">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Browse vehicles
          </h1>
          <p className="mt-2 text-sm text-muted">
            {/* Not "verified listings" — this is every approved listing, and
                approval isn't verification. Same overclaim the homepage heading
                had; see migration 0032 and lib/listing-badges.ts. */}
            {rows.length} {rows.length === 1 ? "listing" : "listings"}
            {category ? ` · ${category}` : ""}
            {hasFilters ? " matching your filters" : " available now"}.
          </p>

          <ul aria-label="Category" className="mt-5 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <li key={chip.label}>
                <Link
                  href={chip.href}
                  aria-current={chip.active ? "true" : undefined}
                  className={cn(
                    "flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold",
                    chip.active
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-white text-ink hover:border-ink",
                  )}
                >
                  {chip.active ? <CheckIcon size={16} /> : null}
                  {chip.label}
                </Link>
              </li>
            ))}
          </ul>

          <form
            method="get"
            className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_9rem_9rem_auto] lg:items-end"
          >
            <label className="flex min-w-0 flex-col gap-1">
              <span className={labelClass}>Make</span>
              <span className="relative flex items-center">
                <select
                  name="make"
                  defaultValue={make}
                  className={cn(inputClass, "w-full appearance-none pr-9")}
                >
                  <option value="">All makes</option>
                  {makes.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon size={18} className="pointer-events-none absolute right-3 text-muted" />
              </span>
            </label>
            {/* Kept across "Apply filters": the category chip. */}
            {body ? <input type="hidden" name="type" value={body} /> : null}
            {fuel ? <input type="hidden" name="fuel" value={fuel} /> : null}
            <label className="flex min-w-0 flex-col gap-1">
              <span className={labelClass}>Keyword</span>
              <input
                type="search"
                name="q"
                defaultValue={keyword}
                placeholder="Model, trim…"
                maxLength={80}
                enterKeyHint="search"
                className={cn(inputClass, "w-full")}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className={labelClass}>Min price (USD)</span>
              <input
                type="number"
                name="min"
                min={0}
                step={500}
                inputMode="numeric"
                defaultValue={minPrice ?? ""}
                placeholder="0"
                className={cn(inputClass, "w-full")}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className={labelClass}>Max price (USD)</span>
              <input
                type="number"
                name="max"
                min={0}
                step={500}
                inputMode="numeric"
                defaultValue={maxPrice ?? ""}
                placeholder="Any"
                className={cn(inputClass, "w-full")}
              />
            </label>
            <div className="col-span-2 flex items-center gap-3 lg:col-span-1">
              <button type="submit" className={buttonClasses({ className: "flex-1 lg:flex-none" })}>
                <SearchIcon size={18} />
                Apply filters
              </button>
              {hasFilters ? (
                <Link
                  href="/browse"
                  className="flex h-11 items-center px-2 text-sm font-semibold text-muted hover:text-ink"
                >
                  Clear
                </Link>
              ) : null}
            </div>
          </form>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {rows.length === 0 && (makeRows ?? []).length === 0 ? (
          // Nothing approved at all — not a filter problem. Offer the
          // waitlist instead of a dead end.
          <div className="flex flex-col gap-6">
            <EmptyState
              title="No cars are listed yet."
              body="The first verified listings are on their way."
            />
            {isPrelaunch() ? <WaitlistForm source="browse" /> : null}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No vehicles match your filters yet."
            body="Try widening the price range or clearing the make filter."
          >
            <Link href="/browse" className={buttonClasses({ variant: "secondary", className: "mt-6" })}>
              Clear filters
            </Link>
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((v) => (
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
        )}
        {rows.length > 0 ? <FxNote fx={fx} className="mt-4" /> : null}
      </main>
    </div>
  );
}

function EmptyState({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className={cardClasses({ className: "flex flex-col items-center px-6 py-12 text-center" })}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-band text-ink">
        <CarIcon size={24} />
      </span>
      <p className="mt-4 font-display text-xl font-bold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>
      {children}
    </div>
  );
}

// Approved inventory changes as admins review listings; don't cache the page.
export const dynamic = "force-dynamic";
