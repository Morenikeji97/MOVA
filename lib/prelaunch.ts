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

/** Countries offered on the waitlist form: the launch markets, then "Other". */
export const WAITLIST_COUNTRIES = [
  { code: "NG", name: "Nigeria" },
  { code: "GH", name: "Ghana" },
  { code: "TG", name: "Togo" },
  { code: "BJ", name: "Benin" },
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
 * "+234 803-123 4567", "+1 (631) 617‑3816" (non-breaking hyphen/space, as
 * phone keyboards and copy-paste often produce), "00234…" -> "+2348031234567".
 * Keeps digits only, with a leading "+" when the number had one (or "00").
 * Returns null if what's left isn't 7-15 digits (the E.164 range).
 */
export function normalizeWhatsapp(raw: string): string | null {
  const trimmed = raw.trim();
  const international = trimmed.startsWith("+") || trimmed.startsWith("00");
  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("00")) digits = digits.slice(2);
  if (digits.length < 7 || digits.length > 15) return null;
  return international ? `+${digits}` : digits;
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
  const whatsapp = whatsappRaw ? normalizeWhatsapp(whatsappRaw) : null;
  if (whatsappRaw && !whatsapp) {
    return {
      ok: false,
      error: "Enter your WhatsApp number with its country code, e.g. +234 803 123 4567.",
    };
  }
  const known = WAITLIST_COUNTRIES.find((c) => c.code === country);
  if (!known) {
    return { ok: false, error: "Choose your country." };
  }
  return {
    ok: true,
    email: email ? email.toLowerCase() : null,
    whatsapp,
    country: known.code,
  };
}
