/**
 * ShipMova — title history from VinAudit (stolen, salvage, junk, odometer
 * brands from NMVTIS). STUB until the founder has an API key: with no
 * VINAUDIT_API_KEY set, every lookup is "not run yet" and nothing is called.
 *
 * When the key arrives (entered by the founder with hidden input, never in
 * chat): implement `fetchTitleHistory` against VinAudit's documented API,
 * store the result per listing (needs a migration + "approve"), and show it
 * in components/listing-checks.tsx. See docs/LAUNCH-BLOCKERS.md.
 */

export type TitleHistory =
  | { status: "not_configured" }
  | { status: "not_run" };

export function isVinAuditConfigured(): boolean {
  return Boolean(process.env.VINAUDIT_API_KEY?.trim());
}

/** Never calls out yet: there's no key, and no stored result to show. */
export async function fetchTitleHistory(_vin: string | null): Promise<TitleHistory> {
  return isVinAuditConfigured() ? { status: "not_run" } : { status: "not_configured" };
}

export const TITLE_HISTORY_LABEL: Record<TitleHistory["status"], string> = {
  not_configured: "Not run yet — ShipMova's title-history check (VinAudit) isn't switched on yet",
  not_run: "Not run yet",
};
