import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { FX_CURRENCIES, FX_SOURCE_URL, parseErApiResponse, type FxCurrency, type FxRates } from "@/lib/fx-format";

/**
 * ShipMova — USD → naira / cedi / CFA rates for the local prices shown next to
 * dollar prices. Server-only.
 *
 * At most one request an hour reaches open.er-api.com (its free tier
 * refreshes daily and asks for no more than hourly). Every good response is
 * stored in public.fx_rates (migration 0050); if the provider is down or
 * returns something unusable, the last stored rates are shown instead, with
 * their own update time. Null only if neither has ever worked, in which case
 * pages show dollars alone.
 */
export const getFxRates = unstable_cache(fetchOrLastGood, ["fx-rates-usd-v1"], {
  revalidate: 3600,
});

async function fetchOrLastGood(): Promise<FxRates | null> {
  try {
    const res = await fetch(FX_SOURCE_URL, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    const fresh = res.ok ? parseErApiResponse(await res.json()) : null;
    if (fresh) {
      await store(fresh);
      return fresh;
    }
    console.error("fx: unusable response from open.er-api.com", res.status);
  } catch (err) {
    console.error("fx: fetch failed", err);
  }
  return lastGood();
}

async function store(fx: FxRates): Promise<void> {
  const { error } = await createAdminClient()
    .from("fx_rates")
    .upsert(
      FX_CURRENCIES.map((currency) => ({
        currency,
        usd_rate: fx.rates[currency],
        provider_updated_at: fx.updatedAt,
        fetched_at: new Date().toISOString(),
      })),
    );
  // Not fatal: the fresh rates are still shown; only the fallback is stale.
  if (error) console.error("fx: storing rates failed", error);
}

async function lastGood(): Promise<FxRates | null> {
  const { data, error } = await createAdminClient()
    .from("fx_rates")
    .select("currency, usd_rate, provider_updated_at")
    .in("currency", [...FX_CURRENCIES]);
  if (error || !data || data.length !== FX_CURRENCIES.length) return null;

  const rates = {} as Record<FxCurrency, number>;
  for (const row of data) rates[row.currency as FxCurrency] = Number(row.usd_rate);
  // All three are written together, but report the oldest if they ever differ.
  const updatedAt = data.map((r) => r.provider_updated_at).sort()[0];
  return { rates, updatedAt: new Date(updatedAt).toISOString() };
}
