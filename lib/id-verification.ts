/**
 * ShipMova — when buyers can verify their ID (NIN, or BVN) through Dojah.
 *
 * Only against Dojah's live API. Sandbox only recognises Dojah's test
 * numbers, so a real NIN sent there just fails — and real ID numbers
 * shouldn't go to a test system at all. Until the live keys are in, the
 * dashboard says ID verification opens at launch and the server action
 * refuses before calling Dojah.
 *
 * Requiring a verified ID to reserve is a separate switch in the database
 * (platform_settings.require_buyer_id_check, migration 0057), turned on with
 * the live keys on launch day.
 */
export const DOJAH_LIVE_URL = "https://api.dojah.io";

export const ID_CHECK_OPENS_AT_LAUNCH =
  "ID verification opens at launch. You can sign up, browse and save cars now — you'll verify your NIN before your first reservation.";

export const ID_CHECK_REQUIRED_TO_RESERVE =
  "Verify your ID (NIN) on your dashboard before reserving. It takes a minute.";

export function isIdVerificationLive(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const base = (env.DOJAH_BASE_URL ?? "").replace(/\/+$/, "");
  return base === DOJAH_LIVE_URL && Boolean(env.DOJAH_SECRET_KEY) && Boolean(env.DOJAH_APP_ID);
}
