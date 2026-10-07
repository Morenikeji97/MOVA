/**
 * ShipMova — the header's currency switcher (USD / NGN / GHS / CFA).
 *
 * Display only: every price is still charged in USD; the switcher only picks
 * which local equivalent (from lib/fx.ts's exchange rates) is shown next to
 * the dollar price. "USD" shows dollars alone. The choice lives in a cookie
 * on the visitor's device; with no cookie, pages show what they always have
 * (naira on cards, the buyer's own currency first on a listing).
 * No imports, so node tests and client components can use it.
 */

export const DISPLAY_CURRENCY_COOKIE = "sm_currency";

export const DISPLAY_CURRENCIES = [
  { code: "USD", label: "USD", name: "US dollar" },
  { code: "NGN", label: "NGN", name: "Nigerian naira" },
  { code: "GHS", label: "GHS", name: "Ghanaian cedi" },
  { code: "XOF", label: "CFA", name: "West African CFA franc" },
] as const;

export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number]["code"];
type LocalCurrency = Exclude<DisplayCurrency, "USD">;

/** The switcher's choice from the cookie, or null when there isn't a valid one. */
export function parseDisplayCurrency(value: unknown): DisplayCurrency | null {
  return DISPLAY_CURRENCIES.some((c) => c.code === value) ? (value as DisplayCurrency) : null;
}

/** What the switcher shows as selected: the choice, else naira (the cards' default). */
export function selectedDisplayCurrency(choice: DisplayCurrency | null): DisplayCurrency {
  return choice ?? "NGN";
}

/** Local currencies on a listing card: the choice (none for USD), else naira. */
export function cardCurrencies(choice: DisplayCurrency | null): LocalCurrency[] {
  if (choice === "USD") return [];
  return [choice ?? "NGN"];
}

/**
 * Local currencies on a listing page: the choice first, then the others in
 * the page's usual order; none for USD; the usual order with no choice.
 */
export function detailCurrencies<T extends LocalCurrency>(choice: DisplayCurrency | null, usual: T[]): T[] {
  if (choice === "USD") return [];
  if (!choice) return usual;
  const chosen = usual.filter((c) => c === choice);
  return [...chosen, ...usual.filter((c) => c !== choice)];
}
