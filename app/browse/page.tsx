import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/button";
import { VinData } from "@/components/ui/vin-data";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

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
    .select(
      "id, year, make, model, trim, price_usd, mileage, location_city, location_state"
    )
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (make) query = query.eq("make", make);
  if (minPrice !== null) query = query.gte("price_usd", minPrice);
  if (maxPrice !== null) query = query.lte("price_usd", maxPrice);

  const { data: vehicles } = await query;
  const rows = vehicles ?? [];

  const ids = rows.map((v) => v.id);
  const { data: photos } = ids.length
    ? await supabase
        .from("vehicle_photos")
        .select("vehicle_id, url, is_primary, sort_order")
        .in("vehicle_id", ids)
        .order("sort_order", { ascending: true })
    : { data: [] };

  // First photo by sort order, unless one is explicitly flagged primary.
  const thumbByVehicle = new Map<string, string>();
  for (const p of photos ?? []) {
    if (!thumbByVehicle.has(p.vehicle_id) || p.is_primary) {
      thumbByVehicle.set(p.vehicle_id, p.url);
    }
  }

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
                <Link
                  href={`/browse/${v.id}`}
                  className="group flex h-full flex-col overflow-hidden rounded-lg border border-paper-200 bg-paper-100 shadow-sm transition-colors hover:border-marine"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-paper-200">
                    {thumbByVehicle.get(v.id) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbByVehicle.get(v.id)}
                        alt={`${v.year} ${v.make} ${v.model}`}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center font-mono text-xs uppercase tracking-wider text-ink-400">
                        No photo
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <h2 className="text-lg font-semibold text-ink-900">
                      {v.year} {v.make} {v.model}
                      {v.trim ? ` ${v.trim}` : ""}
                    </h2>
                    <p className="text-xl font-semibold text-ink-900">
                      {usd.format(Number(v.price_usd))}
                    </p>
                    <div className="mt-auto grid grid-cols-2 gap-3 pt-1">
                      <VinData
                        label="Mileage"
                        value={`${v.mileage.toLocaleString("en-US")} mi`}
                      />
                      <VinData
                        label="Location"
                        value={`${v.location_city}, ${v.location_state}`}
                      />
                    </div>
                  </div>
                </Link>
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
