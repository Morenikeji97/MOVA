/**
 * ShipMova — buyer ID verification at sign-up (founder's decision 2026-10-05).
 *
 * A buyer account isn't usable until verified. No selfies.
 *   Nigeria (NG): NIN, looked up through Dojah; name must match the record.
 *   Ghana (GH):   Ghana Card, looked up through Dojah; same name rule.
 *   Togo (TG) / Benin (BJ): photo of a national ID or passport, reviewed by
 *                 the founder in admin.
 * A name that doesn't match goes to the founder's review, not a rejection.
 *
 * Sandbox: Dojah's sandbox only answers its published test numbers, and real
 * ID numbers must never go to a test system. Until the live keys are in,
 * only those test numbers are let through; anything else is refused before
 * contacting Dojah. (Dojah publishes no Ghana Card test number, so no Ghana
 * Card can verify until launch.)
 */
export const DOJAH_LIVE_URL = "https://api.dojah.io";

/** Private bucket for Togo/Benin ID photos (0058): no read access for anyone through the API. */
export const BUYER_ID_BUCKET = "buyer-id-documents";

export const ID_CHECK_OPENS_AT_LAUNCH = "ID verification opens at launch — join the waitlist.";

export const ID_CHECK_REQUIRED_TO_RESERVE =
  "Verify your ID on your account before reserving.";

export const ID_COUNTRIES = [
  { code: "NG", name: "Nigeria", method: "ng_nin", idLabel: "NIN" },
  { code: "GH", name: "Ghana", method: "gh_card", idLabel: "Ghana Card number" },
  { code: "TG", name: "Togo", method: "document", idLabel: "National ID or passport" },
  { code: "BJ", name: "Benin", method: "document", idLabel: "National ID or passport" },
] as const;

export type IdCountry = (typeof ID_COUNTRIES)[number]["code"];
export type IdMethod = (typeof ID_COUNTRIES)[number]["method"];

export function idCountry(code: unknown): (typeof ID_COUNTRIES)[number] | null {
  return ID_COUNTRIES.find((c) => c.code === code) ?? null;
}

/**
 * Dojah's published sandbox test numbers (docs.dojah.io → Sandbox & test
 * data, checked 2026-10-05). Ghana: none published.
 */
export const DOJAH_SANDBOX_TEST_NUMBERS: Record<"ng_nin" | "gh_card", readonly string[]> = {
  ng_nin: ["70123456789"],
  gh_card: [],
};

export function isIdVerificationLive(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const base = (env.DOJAH_BASE_URL ?? "").replace(/\/+$/, "");
  return base === DOJAH_LIVE_URL && Boolean(env.DOJAH_SECRET_KEY) && Boolean(env.DOJAH_APP_ID);
}

/** Whether this number may be sent to Dojah now (live: any; sandbox: test numbers only). */
export function mayContactDojah(
  method: "ng_nin" | "gh_card",
  idNumber: string,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (isIdVerificationLive(env)) return true;
  return DOJAH_SANDBOX_TEST_NUMBERS[method].includes(idNumber);
}

/** Normalised ID number, or null when it isn't in the right shape. */
export function cleanIdNumber(method: "ng_nin" | "gh_card", raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (method === "ng_nin") {
    const v = raw.replace(/\s+/g, "");
    return /^\d{11}$/.test(v) ? v : null;
  }
  // Ghana Card: GHA-123456789-0 (dashes optional when typed).
  const v = raw.toUpperCase().replace(/[\s-]+/g, "");
  const m = /^GHA(\d{9})(\d)$/.exec(v);
  return m ? `GHA-${m[1]}-${m[2]}` : null;
}

/** A legal name worth checking: two or more words, letters only, ≤200 chars. */
export function cleanLegalName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.replace(/\s+/g, " ").trim();
  if (v.length < 3 || v.length > 200) return null;
  if (v.split(" ").length < 2) return null;
  if (!/^[\p{L}\s'.-]+$/u.test(v)) return null;
  return v;
}
