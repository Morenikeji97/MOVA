import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/button";
import { VehicleCard, type VehicleCardData } from "@/components/ui/vehicle-card";
import { LISTING_CARD_COLUMNS, loadListingThumbnails } from "@/lib/listings";

const inputClass =
  "h-11 rounded border border-paper-200 bg-paper-100 px-3 text-ink-900";

/** Reads a single-value string search param, ignoring arrays and blanks. */
function str(value: string | string[] | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Reads a non-negative integer search param, or null when absent/invalid. */
function int(value: string | string[] | undefined): number | null {
  const s = str(value);
  return /^\d+$/.test(s) ? Number(s) : null;
}

function BrowseHeader() {
  return (
    <header className="border-b border-paper-200 bg-paper-100">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-mono text-sm font-semibold uppercase tracking-widest text-ink-900">
          MOVA
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-slate-500 hover:text-ink-900">
            Sign in
          </Link>
          <Link href="/signup" className={buttonClasses({ size: "sm" })}>
            Create account
          </Link>
        </nav>
      </div>
    </header>
  );
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
  const hasFilters = make !== "" || minPrice !== null || maxPrice !== null;

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

  const { data: vehicles } = await query;
  const rows = (vehicles ?? []) as VehicleCardData[];

  const thumbByVehicle = await loadListingThumbnails(
    supabase,
    rows.map((v) => v.id),
  );

  return (
    <div className="min-h-screen bg-paper">
      <BrowseHeader />

      <main className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-ink-900">Browse vehicles</h1>
        <p className="mt-2 text-sm text-slate-500">
          {rows.length} verified {rows.length === 1 ? "listing" : "listings"}
          {hasFilters ? " matching your filters" : " available now"}.
        </p>

        <form
          method="get"
          className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-paper-200 bg-paper-100 p-4"
        >
          <label className="flex flex-col gap-1">
            <span className="font-mono text-xs uppercase tracking-wider text-ink-400">
              Make
            </span>
            <select name="make" defaultValue={make} className={cn(inputClass, "min-w-40")}>
              <option value="">All makes</option>
              {makes.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-xs uppercase tracking-wider text-ink-400">
              Min price (USD)
            </span>
            <input
              type="number"
              name="min"
              min={0}
              step={500}
              defaultValue={minPrice ?? ""}
              placeholder="0"
              className={cn(inputClass, "w-36")}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-xs uppercase tracking-wider text-ink-400">
              Max price (USD)
            </span>
            <input
              type="number"
              name="max"
              min={0}
              step={500}
              defaultValue={maxPrice ?? ""}
              placeholder="Any"
              className={cn(inputClass, "w-36")}
            />
          </label>
          <button type="submit" className={buttonClasses({ size: "md" })}>
            Apply filters
          </button>
          {hasFilters ? (
            <Link
              href="/browse"
              className="text-sm text-slate-500 hover:text-ink-900"
            >
              Clear
            </Link>
          ) : null}
        </form>

        {rows.length === 0 ? (
          <div className="mt-10 rounded-lg border border-dashed border-paper-200 bg-paper-100 p-12 text-center">
            <p className="text-ink-900">No vehicles match your filters yet.</p>
            <p className="mt-1 text-sm text-slate-500">
              Try widening the price range or clearing the make filter.
            </p>
          </div>
        ) : (
          <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((v) => (
              <li key={v.id}>
                <VehicleCard
                  vehicle={v}
                  thumbnailUrl={thumbByVehicle.get(v.id) ?? null}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

// Approved inventory changes as admins review listings; don't cache the page.
export const dynamic = "force-dynamic";
