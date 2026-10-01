/**
 * ShipMova — local-currency equivalents of USD prices (pure helpers; the
 * fetching and storing is in lib/fx.ts).
 *
 * Rates come from ExchangeRate-API's open endpoint, which requires the
 * FX_ATTRIBUTION link on every page that shows them.
 */

export const FX_SOURCE_URL = "https://open.er-api.com/v6/latest/USD";
export const FX_ATTRIBUTION = {
  href: "https://www.exchangerate-api.com",
  text: "Rates By Exchange Rate API",
} as const;

/** Naira (Nigeria), cedi (Ghana), West African CFA franc (Togo, Benin). */
export const FX_CURRENCIES = ["NGN", "GHS", "XOF"] as const;
export type FxCurrency = (typeof FX_CURRENCIES)[number];

export type FxRates = {
  /** Units of each currency per 1 USD. */
  rates: Record<FxCurrency, number>;
  /** When the provider last updated the rates (ISO 8601). */
  updatedAt: string;
};

const SYMBOL: Record<FxCurrency, string> = { NGN: "₦", GHS: "GH₵", XOF: "CFA " };

/** The currency of each buyer country ShipMova serves. */
const COUNTRY_CURRENCY: Record<string, FxCurrency> = { NG: "NGN", GH: "GHS", TG: "XOF", BJ: "XOF" };

/** A successful open.er-api.com response, reduced to what ShipMova shows; else null. */
export function parseErApiResponse(body: unknown): FxRates | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { result?: unknown; base_code?: unknown; time_last_update_unix?: unknown; rates?: unknown };
  if (b.result !== "success" || b.base_code !== "USD") return null;
  if (typeof b.time_last_update_unix !== "number" || !b.rates || typeof b.rates !== "object") return null;

  const source = b.rates as Record<string, unknown>;
  const rates = {} as Record<FxCurrency, number>;
  for (const c of FX_CURRENCIES) {
    const r = source[c];
    if (typeof r !== "number" || !Number.isFinite(r) || r <= 0) return null;
    rates[c] = r;
  }
  return { rates, updatedAt: new Date(b.time_last_update_unix * 1000).toISOString() };
}

/** "≈ ₦24,500,000" — three significant figures, since it's an estimate. */
export function formatLocal(usd: number, currency: FxCurrency, rate: number): string {
  const amount = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 3 }).format(usd * rate);
  return `≈ ${SYMBOL[currency]}${amount}`;
}

/** "1 Oct, 00:02 UTC" */
export function formatFxUpdated(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(d);
  return `${date}, ${time} UTC`;
}

/** All three currencies, the buyer's own (by profile country) first. */
export function currenciesFor(country: string | null | undefined): FxCurrency[] {
  const mine = country ? COUNTRY_CURRENCY[country] : undefined;
  return mine ? [mine, ...FX_CURRENCIES.filter((c) => c !== mine)] : [...FX_CURRENCIES];
}
