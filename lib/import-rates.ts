import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { DEFAULT_NG_RATES, ratesFromRow, type NigeriaRates } from "@/lib/landed-cost";

/** Rates not checked for longer than this show as due for a re-check (admin page + dashboard). */
export const STALE_AFTER_DAYS = 30;

export interface LoadedNigeriaRates {
  rates: NigeriaRates;
  /** ISO time staff last confirmed the rates; null when using the code defaults. */
  lastVerifiedAt: string | null;
}

/**
 * The live Nigerian import rates from public.import_rates (migration 0051),
 * readable by anyone. Falls back to the published defaults in
 * lib/landed-cost.ts if the row can't be read, so a listing page never
 * breaks over it.
 */
export async function loadNigeriaRates(supabase: SupabaseClient<Database>): Promise<LoadedNigeriaRates> {
  const { data, error } = await supabase
    .from("import_rates")
    .select("*")
    .eq("country", "NG")
    .maybeSingle();
  if (error || !data) return { rates: DEFAULT_NG_RATES, lastVerifiedAt: null };
  return { rates: ratesFromRow(data), lastVerifiedAt: data.last_verified_at ?? null };
}
