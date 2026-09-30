/**
 * ShipMova — pre-launch mode.
 *
 * PRELAUNCH is a server-only env var, set to "true" in Netlify for
 * production and deploy previews. While it's on:
 *   - every page shows the launching-soon banner (components/ui/prelaunch-banner.tsx);
 *   - reserving a car and every ShipMova-fee payment step are refused by the
 *     server actions themselves, and the UI offers the waitlist instead;
 *   - seller listing creation and admin review work as normal.
 *
 * Fails closed: anything other than the exact string "false" counts as on,
 * so a missing or mistyped variable can't quietly open reservations.
 *
 * The same rule is enforced in the database for callers that skip the app
 * entirely (a buyer hitting the REST API with their own session):
 * public.platform_settings.prelaunch + the purchase_requests_prelaunch_guard
 * trigger (migration 0039).
 *
 * BEFORE going live, every box in docs/LAUNCH-BLOCKERS.md must be ticked:
 * the public copy describes features (escrow, inspection, shipper insurance
 * checks, partner rewards) that aren't built yet. Going live means flipping BOTH:
 *   1. PRELAUNCH=false in Netlify (then redeploy), and
 *   2. `update public.platform_settings set prelaunch = false;`
 */
export function isPrelaunch(): boolean {
  return process.env.PRELAUNCH?.trim().toLowerCase() !== "false";
}

export const PRELAUNCH_BANNER = "ShipMova is launching soon — here's how it will work.";

/** What a refused reserve/pay attempt returns. */
export const PRELAUNCH_REFUSAL =
  "ShipMova isn't taking reservations or payments yet — join the waitlist and we'll tell you the moment we launch.";

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

/** Where a signup came from — mirrors waitlist_signups_source_check (0046). */
export const WAITLIST_SOURCES = [
  "site",
  "listing",
  "dashboard",
  "home",
  "how_it_works",
  "browse",
  "sell",
  "shipper",
  "inspectors",
  "clearing_agents",
] as const;
export type WaitlistSource = (typeof WAITLIST_SOURCES)[number];

/** Who signed up — mirrors waitlist_signups_audience_check (0046). */
export const WAITLIST_AUDIENCES = ["buyer", "seller", "shipper", "inspector", "clearing_agent"] as const;
export type WaitlistAudience = (typeof WAITLIST_AUDIENCES)[number];

export const WAITLIST_AUDIENCE_LABEL: Record<WaitlistAudience, string> = {
  buyer: "Buyer",
  seller: "Seller",
  shipper: "Shipper",
  inspector: "Inspector",
  clearing_agent: "Clearing agent",
};

/** Nigerian ports a clearing agent can say they serve (0046 check). */
export const NIGERIA_PORTS = ["Apapa", "Tin Can Island", "Onne"] as const;
export type NigeriaPort = (typeof NIGERIA_PORTS)[number];

export type PartnerWaitlistInput = {
  audience: "inspector" | "clearing_agent";
  fullName: string;
  email: string;
  whatsapp: string;
  company: string;
  cityState: string;
  experience: string;
  ports: string[];
  licenseNumber: string;
};

export type PartnerWaitlistValidation =
  | {
      ok: true;
      row: {
        audience: "inspector" | "clearing_agent";
        country: WaitlistCountryCode;
        full_name: string;
        email: string;
        whatsapp: string;
        company: string | null;
        city_state: string | null;
        experience: string | null;
        ports_served: NigeriaPort[] | null;
        license_number: string | null;
      };
    }
  | { ok: false; error: string };

/**
 * Validates an /inspectors or /clearing-agents signup. Inspectors are in
 * the U.S. (country US); clearing agents are in Nigeria (country NG), so
 * each WhatsApp number is resolved against that country.
 *
 *   inspector:      name, email, WhatsApp, city/state, car experience
 *   clearing_agent: name, company, WhatsApp, email, at least one port;
 *                   license / CAC number optional
 */
export function validatePartnerWaitlist(input: PartnerWaitlistInput): PartnerWaitlistValidation {
  const t = (s: string) => s.trim();
  const fullName = t(input.fullName);
  const email = t(input.email);
  const whatsappRaw = t(input.whatsapp);
  const country: WaitlistCountryCode = input.audience === "inspector" ? "US" : "NG";

  if (!fullName) return { ok: false, error: "Enter your name." };
  if (fullName.length > 120) return { ok: false, error: "That name is too long." };
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!whatsappRaw) return { ok: false, error: "Enter your WhatsApp number." };
  const w = toInternationalWhatsapp(whatsappRaw, country);
  if (!w.ok) return w;

  if (input.audience === "inspector") {
    const cityState = t(input.cityState);
    const experience = t(input.experience);
    if (!cityState) return { ok: false, error: "Enter your city and state." };
    if (cityState.length > 120) return { ok: false, error: "Keep city and state under 120 characters." };
    if (!experience) return { ok: false, error: "Tell us a little about your car experience." };
    if (experience.length > 1000) return { ok: false, error: "Keep your car experience under 1,000 characters." };
    return {
      ok: true,
      row: {
        audience: "inspector", country, full_name: fullName, email: email.toLowerCase(), whatsapp: w.e164,
        company: null, city_state: cityState, experience, ports_served: null, license_number: null,
      },
    };
  }

  const company = t(input.company);
  const license = t(input.licenseNumber);
  const ports = [...new Set(input.ports.map(t))];
  if (!company) return { ok: false, error: "Enter your company name." };
  if (company.length > 160) return { ok: false, error: "That company name is too long." };
  if (ports.length === 0) return { ok: false, error: "Choose at least one port you serve." };
  if (!ports.every((p): p is NigeriaPort => (NIGERIA_PORTS as readonly string[]).includes(p))) {
    return { ok: false, error: "Choose ports from the list." };
  }
  if (license.length > 80) return { ok: false, error: "That license / CAC number is too long." };
  return {
    ok: true,
    row: {
      audience: "clearing_agent", country, full_name: fullName, email: email.toLowerCase(), whatsapp: w.e164,
      company, city_state: null, experience: null, ports_served: ports as NigeriaPort[],
      license_number: license || null,
    },
  };
}

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
