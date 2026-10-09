import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { formatCheckedDate, IMPORT_COUNTRY_NAME } from "@/lib/import-rules";
import { DEFAULT_LANDED_COST_RATES, isLandedCountry, type LandedCountry } from "@/lib/landed-cost";
import { SHIPPING_ESTIMATES } from "@/lib/shipping-estimates";
import { cardClasses } from "@/components/ui/card";
import { BackLink, DashboardHeader, DashboardShell, Notice } from "@/components/ui/dashboard";
import { LandedRatesForm } from "./rates-form";

export const metadata: Metadata = { title: "Landed-cost rates — ShipMova admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const COUNTRIES: readonly LandedCountry[] = ["NG", "GH", "TG", "BJ"];
const text = (v: number | string | null | undefined) => (v == null ? "" : String(Number(v)));

/**
 * The figures behind the "Estimated delivered cost" on every listing
 * (lib/landed-cost.ts). One card per country; saving marks it checked today.
 */
export default async function LandedCostRatesPage() {
  const ctx = await requireAdmin();
  if (!ctx) redirect("/login?next=/admin/landed-cost");

  const { data: rows, error } = await ctx.supabase
    .from("landed_cost_rates")
    .select(
      "country, duties_min_pct, duties_max_pct, insurance_pct, fixed_fees_usd, port_clearing_min_usd, port_clearing_max_usd, source_note, source_url, last_checked_on",
    );
  const byCountry = new Map((rows ?? []).filter((r) => isLandedCountry(r.country)).map((r) => [r.country, r]));

  return (
    <DashboardShell narrow>
      <BackLink href="/admin/dashboard">Admin dashboard</BackLink>
      <DashboardHeader
        className="mt-2"
        eyebrow="Admin"
        title="Landed-cost rates"
        intro="The figures behind “Estimated delivered cost” on every listing. Confirm them with clearing agents; saving marks a country checked today."
      />
      {error ? (
        <Notice tone="warning" role="alert" className="mt-4">
          Couldn&rsquo;t load the rates ({error.message}). Listings are showing the built-in figures.
        </Notice>
      ) : null}

      {COUNTRIES.map((c) => {
        const r = byCountry.get(c);
        const port = SHIPPING_ESTIMATES.find((e) => e.code === c)?.port ?? "";
        if (!r) {
          return (
            <section key={c} className={cardClasses({ className: "mt-4" })}>
              <h2 className="font-display text-xl font-bold text-ink">{IMPORT_COUNTRY_NAME[c]} · {port}</h2>
              <p className="mt-2 text-sm text-muted">
                No saved row yet — listings use the built-in figures ({DEFAULT_LANDED_COST_RATES[c].dutiesPct.min}–
                {DEFAULT_LANDED_COST_RATES[c].dutiesPct.max}% of CIF).
              </p>
            </section>
          );
        }
        return (
          <section key={c} className={cardClasses({ className: "mt-4" })}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-xl font-bold text-ink">{IMPORT_COUNTRY_NAME[c]} · {port}</h2>
              <span className="text-xs text-muted">Last checked {formatCheckedDate(r.last_checked_on)}</span>
            </div>
            <LandedRatesForm
              country={c}
              values={{
                duties_min_pct: text(r.duties_min_pct),
                duties_max_pct: text(r.duties_max_pct),
                insurance_pct: text(r.insurance_pct),
                fixed_fees_usd: text(r.fixed_fees_usd),
                port_clearing_min_usd: text(r.port_clearing_min_usd),
                port_clearing_max_usd: text(r.port_clearing_max_usd),
                source_note: r.source_note,
                source_url: r.source_url ?? "",
              }}
            />
          </section>
        );
      })}
    </DashboardShell>
  );
}
