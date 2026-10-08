import { cookies } from "next/headers";
import { DISPLAY_CURRENCY_COOKIE, parseDisplayCurrency, type DisplayCurrency } from "@/lib/display-currency";

/** The visitor's currency-switcher choice (lib/display-currency.ts), or null. */
export async function getDisplayCurrency(): Promise<DisplayCurrency | null> {
  return parseDisplayCurrency((await cookies()).get(DISPLAY_CURRENCY_COOKIE)?.value);
}
