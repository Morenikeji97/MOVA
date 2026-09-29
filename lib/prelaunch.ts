/**
 * MOVA — pre-launch mode.
 *
 * PRELAUNCH is a server-only env var, set to "true" in Netlify for
 * production and deploy previews. While it's on:
 *   - every page shows the launching-soon banner (components/ui/prelaunch-banner.tsx);
 *   - reserving a car and every MOVA-fee payment step are refused by the
 *     server actions themselves, and the UI offers the waitlist instead;
 *   - seller listing creation and admin review work as normal.
 *
 * Fails closed: anything other than the exact string "false" counts as on,
 * so a missing or mistyped variable can't quietly open reservations.
 *
 * The same rule is enforced in the database for callers that skip the app
 * entirely (a buyer hitting the REST API with their own session):
 * public.platform_settings.prelaunch + the purchase_requests_prelaunch_guard
 * trigger (migration 0039). Going live means flipping BOTH:
 *   1. PRELAUNCH=false in Netlify (then redeploy), and
 *   2. `update public.platform_settings set prelaunch = false;`
 */
export function isPrelaunch(): boolean {
  return process.env.PRELAUNCH?.trim().toLowerCase() !== "false";
}

export const PRELAUNCH_BANNER = "MOVA is launching soon — here's how it will work.";

/** What a refused reserve/pay attempt returns. */
export const PRELAUNCH_REFUSAL =
  "MOVA isn't taking reservations or payments yet — join the waitlist and we'll tell you the moment we launch.";

/**
 * Countries offered on the waitlist form: the launch markets, the United
 * States (where sellers are), then "Other". Mirrors
 * waitlist_signups_country_check (0042).
 */
export const WAITLIST_COUNTRIES = [
  { code: "NG", name: "Nigeria" },
  { code: "GH", name: "Ghana" },
  { code: "TG", name: "Togo" },
  { code: "BJ", name: "Benin" },
  { code: "US", name: "United States" },
  { code: "OTHER", name: "Other" },
] as const;

export type WaitlistCountryCode = (typeof WAITLIST_COUNTRIES)[number]["code"];

/** Where a signup came from — mirrors waitlist_signups_source_check (0041). */
export const WAITLIST_SOURCES = [
  "site",
  "listing",
  "dashboard",
  "home",
  "how_it_works",
  "browse",
  "sell",
] as const;
export type WaitlistSource = (typeof WAITLIST_SOURCES)[number];

/** Buyers waiting to buy, or sellers waiting to list (0041). */
export type WaitlistAudience = "buyer" | "seller";

export type WaitlistInput = {
  email: string;
  whatsapp: string;
  country: string;
};

export type WaitlistValidation =
  | { ok: true; email: string | null; whatsapp: string | null; country: WaitlistCountryCode }
  | { ok: false; error: string };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Dialling rules for each country the form offers (OTHER has none, so its
 * numbers must be typed internationally).
 *   callingCode — the country code, without "+"
 *   nsnLength   — digits in a number after the country code
 *   trunkZero   — whether numbers are written nationally with a leading 0
 *                 that's dropped internationally (0803… -> +234 803…)
 *   nsnStart    — digits a valid number can start with
 * Benin moved to 10-digit numbers ("01" + the old 8 digits) in 2024; the old
 * 8-digit form is rejected with a message rather than guessed at.
 */
const DIALLING: Record<
  Exclude<WaitlistCountryCode, "OTHER">,
  { callingCode: string; nsnLength: number; trunkZero: boolean; nsnStart: RegExp }
> = {
  NG: { callingCode: "234", nsnLength: 10, trunkZero: true, nsnStart: /^[1-9]/ },
  GH: { callingCode: "233", nsnLength: 9, trunkZero: true, nsnStart: /^[1-9]/ },
  TG: { callingCode: "228", nsnLength: 8, trunkZero: false, nsnStart: /^[1-9]/ },
  BJ: { callingCode: "229", nsnLength: 10, trunkZero: false, nsnStart: /^01/ },
  US: { callingCode: "1", nsnLength: 10, trunkZero: false, nsnStart: /^[2-9]/ },
};

const EXAMPLE_NUMBER = "+234 803 123 4567";

export type WhatsappResult = { ok: true; e164: string } | { ok: false; error: string };

/**
 * Any WhatsApp number as typed -> full international format ("+" + country
 * code + number), using the selected country for numbers typed nationally.
 *
 *   Nigeria "0803 123 4567"   -> +2348031234567
 *   US      "631-617-3816"    -> +16316173816
 *   any     "+44 7911 123456" -> +447911123456 (kept: a buyer may have a
 *                                foreign number)
 *   any     "00233 20 …"      -> +23320…
 *
 * Spaces, dashes, dots and brackets are ignored, including the non-breaking
 * variants phone keyboards and copy-paste produce. Numbers that can't be
 * resolved are rejected with a message the form shows.
 */
export function toInternationalWhatsapp(raw: string, country: WaitlistCountryCode): WhatsappResult {
  const trimmed = raw.trim();
  if (/[^0-9+\s\-(). ‐-―]/.test(trimmed)) {
    return { ok: false, error: `Use digits only for your WhatsApp number, e.g. ${EXAMPLE_NUMBER}.` };
  }
  const digits = trimmed.replace(/\D/g, "");

  // Typed internationally: "+…" or "00…".
  if (trimmed.startsWith("+") || trimmed.startsWith("00")) {
    const intl = trimmed.startsWith("00") ? digits.slice(2) : digits;
    if (!/^[1-9]\d{7,14}$/.test(intl)) {
      return { ok: false, error: `That WhatsApp number doesn't look complete — e.g. ${EXAMPLE_NUMBER}.` };
    }
    // If it's this country's code, hold it to this country's length.
    if (country !== "OTHER") {
      const d = DIALLING[country];
      if (intl.startsWith(d.callingCode)) {
        const nsn = intl.slice(d.callingCode.length);
        if (nsn.length !== d.nsnLength || !d.nsnStart.test(nsn)) return nationalError(country);
      }
    }
    return { ok: true, e164: `+${intl}` };
  }

  if (country === "OTHER") {
    return {
      ok: false,
      error: `Add your country code, starting with + (e.g. ${EXAMPLE_NUMBER}), or choose your country above.`,
    };
  }

  const d = DIALLING[country];
  let nsn: string | null = null;
  if (d.trunkZero && digits.length === d.nsnLength + 1 && digits.startsWith("0")) {
    nsn = digits.slice(1); // 0803 123 4567 -> 803 123 4567
  } else if (digits.length === d.nsnLength) {
    nsn = digits; // 631 617 3816
  } else if (
    digits.startsWith(d.callingCode) &&
    digits.length === d.callingCode.length + d.nsnLength
  ) {
    nsn = digits.slice(d.callingCode.length); // 234 803… typed without the +
  }
  if (!nsn || !d.nsnStart.test(nsn)) return nationalError(country);
  return { ok: true, e164: `+${d.callingCode}${nsn}` };
}

function nationalError(country: Exclude<WaitlistCountryCode, "OTHER">): WhatsappResult {
  const name = WAITLIST_COUNTRIES.find((c) => c.code === country)!.name;
  if (country === "BJ") {
    return {
      ok: false,
      error: "That doesn't look like a Benin number — they now have 10 digits starting with 01, e.g. +229 01 97 12 34 56.",
    };
  }
  return {
    ok: false,
    error: `That doesn't look like a ${name} WhatsApp number. Check it, or enter it with the country code, e.g. ${EXAMPLE_NUMBER}.`,
  };
}

/**
 * Validates a waitlist signup: an email or a WhatsApp number (or both), plus
 * a country. The normalized values always satisfy the CHECK constraints on
 * public.waitlist_signups, so the form gives a friendly error instead of a
 * raw constraint violation.
 */
export function validateWaitlist(input: WaitlistInput): WaitlistValidation {
  const email = input.email.trim();
  const whatsappRaw = input.whatsapp.trim();
  const country = input.country.trim();

  if (!email && !whatsappRaw) {
    return { ok: false, error: "Enter an email address or a WhatsApp number." };
  }
  if (email && (email.length > 254 || !EMAIL_RE.test(email))) {
    return { ok: false, error: "That email address doesn't look right." };
  }
  // Country first: a nationally-typed number can't be resolved without it.
  const known = WAITLIST_COUNTRIES.find((c) => c.code === country);
  if (!known) {
    return { ok: false, error: "Choose your country." };
  }
  let whatsapp: string | null = null;
  if (whatsappRaw) {
    const w = toInternationalWhatsapp(whatsappRaw, known.code);
    if (!w.ok) return w;
    whatsapp = w.e164;
  }
  return {
    ok: true,
    email: email ? email.toLowerCase() : null,
    whatsapp,
    country: known.code,
  };
}
