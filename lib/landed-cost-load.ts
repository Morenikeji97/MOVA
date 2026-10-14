import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  DEFAULT_LANDED_COST_RATES,
  isLandedCountry,
  ratesFromRow,
  type LandedCostRates,
  type LandedCountry,
} from "@/lib/landed-cost";

/**
 * The live landed-cost rates (public.landed_cost_rates, 0068), falling back
 * per country to the seed data if the table can't be read — the listing
 * page then still shows a sourced estimate rather than nothing.
 */
export async function loadLandedCostRates(
  supabase: SupabaseClient<Database>,
): Promise<Record<LandedCountry, LandedCostRates>> {
  const out = { ...DEFAULT_LANDED_COST_RATES };
  const { data, error } = await supabase
    .from("landed_cost_rates")
    .select(
      "country, duties_min_pct, duties_max_pct, insurance_pct, fixed_fees_usd, port_clearing_min_usd, port_clearing_max_usd, source_note, source_url, last_checked_on",
    );
  if (error) {
    console.error("landed cost rates: using defaults:", error.message);
    return out;
  }
  for (const row of data ?? []) {
    if (isLandedCountry(row.country)) out[row.country] = ratesFromRow(row);
  }
  return out;
}
