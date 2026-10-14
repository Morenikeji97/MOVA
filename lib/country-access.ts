/**
 * ShipMova — which countries buyers can actually use at launch.
 *
 * At launch, only Nigeria is open to buyers: Ghana, Togo and Benin show as
 * "Coming soon" everywhere a country appears (homepage, sign-up, listing
 * costs) and nobody can create a buyer account from one of them yet — they
 * get a "Notify me when it opens" email sign-up instead (the existing
 * waitlist, lib/prelaunch.ts's WaitlistForm with a locked country).
 *
 * Deliberately separate from isPrelaunch() (lib/prelaunch.ts): prelaunch is
 * "nothing is open to anyone yet, site-wide"; this is "Nigeria is open,
 * these three aren't yet" — a rule that stays true after launch day until
 * ShipMova actually opens Ghana/Togo/Benin to buyers, at which point this
 * file is the one place that changes.
 *
 * Sellers are unaffected: ShipMova's sellers are U.S.-based (Terms &
 * Conditions §2), so there's no seller-side country gate.
 */

import { type ImportCountry, IMPORT_COUNTRY_NAME } from "@/lib/import-rules";

export type BuyerCountryStatus = "open" | "coming_soon";

/** The only country buyers can sign up from today. */
export const BUYER_COUNTRIES_OPEN: readonly ImportCountry[] = ["NG"];

export function isCountryOpenForBuyers(code: string): boolean {
  return (BUYER_COUNTRIES_OPEN as readonly string[]).includes(code);
}

export function buyerCountryStatus(code: ImportCountry): BuyerCountryStatus {
  return isCountryOpenForBuyers(code) ? "open" : "coming_soon";
}

/** All four countries with their current buyer status, Nigeria first. */
export const BUYER_COUNTRY_STATUS: { code: ImportCountry; name: string; status: BuyerCountryStatus }[] = (
  ["NG", "GH", "TG", "BJ"] as const
).map((code) => ({ code, name: IMPORT_COUNTRY_NAME[code], status: buyerCountryStatus(code) }));

export const COMING_SOON_LABEL = "Coming soon";
