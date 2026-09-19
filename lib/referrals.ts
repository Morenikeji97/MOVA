/**
 * MOVA referral program — pure decision logic (no DB access). The
 * DB-orchestration side (loading rows, inserting credits, creating payout
 * batches) lives in lib/referral-credit.ts, same split as
 * lib/shipping.ts (pure) vs lib/shipper-billing.ts (DB-touching).
 */

export const REFERRAL_BATCH_SIZE = 10;
export const REFERRAL_PAYOUT_AMOUNT_USD = 1000;
/** More than this many qualifying credits for one referrer within
 * REFERRAL_FLAG_WINDOW_HOURS gets rate-flagged for admin review (not
 * blocked). */
export const REFERRAL_FLAG_THRESHOLD = 5;
export const REFERRAL_FLAG_WINDOW_HOURS = 24;

/** "https://shipmova.com" + "ABC12345" -> "https://shipmova.com/signup?ref=ABC12345". */
export function buildReferralLink(origin: string, referralCode: string): string {
  return `${origin.replace(/\/+$/, "")}/signup?ref=${encodeURIComponent(referralCode)}`;
}

/**
 * How many $1,000 batches a referrer just crossed, going from
 * `priorQualifyingCount` to `newQualifyingCount` qualifying credits.
 * Batches trigger exactly at multiples of REFERRAL_BATCH_SIZE (10, 20, 30…) —
 * referrals 11-19 sit accrued-but-unpaid until the 20th.  General (floor-
 * difference) rather than a simple modulo check, so it stays correct even if
 * a caller ever advances the count by more than 1 in one step.
 */
export function payoutBatchesTriggered(
  priorQualifyingCount: number,
  newQualifyingCount: number,
): number {
  const before = Math.floor(priorQualifyingCount / REFERRAL_BATCH_SIZE);
  const after = Math.floor(newQualifyingCount / REFERRAL_BATCH_SIZE);
  return Math.max(0, after - before);
}

/** More than REFERRAL_FLAG_THRESHOLD qualifying credits in the trailing window. */
export function shouldFlagForReview(qualifyingInWindow: number): boolean {
  return qualifyingInWindow > REFERRAL_FLAG_THRESHOLD;
}

/**
 * "john.doe+promo@Gmail.com" -> "gmail.com:johndoe" — strips a `+tag` suffix
 * and dots from the local part (the common free-mail-provider aliasing
 * trick) and lowercases both halves, so a referrer can't dodge the
 * email-based self-referral check with a trivially different alias of the
 * same inbox. Returns null for anything that isn't a plausible `local@domain`
 * shape, so an unparseable value never accidentally compares equal to another.
 */
export function normalizeEmailForMatching(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;
  const local = email.slice(0, at).toLowerCase();
  const domain = email.slice(at + 1).toLowerCase();
  const normalizedLocal = local.split("+")[0].replace(/\./g, "");
  if (!normalizedLocal) return null;
  return `${domain}:${normalizedLocal}`;
}

/** Digits-only comparison key — "+1 (555) 123-4567" -> "15551234567". */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

/**
 * Coarse network-neighborhood key for an IP address: the /24 for IPv4 (first
 * three octets) or the /48 for IPv6 (first three hextets) — deliberately
 * coarser than an exact-IP match, since two genuinely different people on
 * the same mobile carrier or NAT gateway would otherwise collide constantly.
 * Returns null for anything that doesn't parse as one of those two shapes.
 */
export function ipSubnetKey(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const trimmed = ip.trim();
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":").filter((p) => p.length > 0);
    if (parts.length < 3) return null;
    return `v6:${parts.slice(0, 3).join(":")}`;
  }
  const octets = trimmed.split(".");
  if (octets.length !== 4 || octets.some((o) => !/^\d{1,3}$/.test(o))) return null;
  return `v4:${octets.slice(0, 3).join(".")}`;
}

export interface SignupSignals {
  email: string | null;
  phone: string | null;
  deviceFingerprint: string | null;
  ip: string | null;
  /** The referred/referrer's own most recent paid fee-transaction card
   * fingerprint, when one exists (buyers only — see lib/referral-credit.ts). */
  paymentFingerprint: string | null;
}

export interface SelfReferralSignals {
  emailPatternMatch: boolean;
  phoneMatch: boolean;
  paymentFingerprintMatch: boolean;
  deviceFingerprintMatch: boolean;
  ipSubnetMatch: boolean;
}

export interface SelfReferralCheck {
  blocked: boolean;
  signals: SelfReferralSignals;
}

/**
 * Compares a referrer and a referred account's signup-time (and, for
 * payment fingerprint, transaction-time) signals. Any single match blocks
 * crediting outright — this is the "Block self-referral" fraud guard, not
 * the softer volume-based rate-flag (see shouldFlagForReview). A signal that
 * can't be compared (either side missing that value) never counts as a
 * match — a missing signal is not evidence of anything.
 */
export function detectSelfReferralSignals(
  referrer: SignupSignals,
  referred: SignupSignals,
): SelfReferralCheck {
  const emailA = normalizeEmailForMatching(referrer.email);
  const emailB = normalizeEmailForMatching(referred.email);
  const phoneA = normalizePhone(referrer.phone);
  const phoneB = normalizePhone(referred.phone);
  const ipA = ipSubnetKey(referrer.ip);
  const ipB = ipSubnetKey(referred.ip);

  const signals: SelfReferralSignals = {
    emailPatternMatch: emailA !== null && emailA === emailB,
    phoneMatch: phoneA !== null && phoneA === phoneB,
    paymentFingerprintMatch:
      referrer.paymentFingerprint !== null &&
      referrer.paymentFingerprint === referred.paymentFingerprint,
    deviceFingerprintMatch:
      referrer.deviceFingerprint !== null &&
      referrer.deviceFingerprint === referred.deviceFingerprint,
    ipSubnetMatch: ipA !== null && ipA === ipB,
  };

  return {
    blocked: Object.values(signals).some(Boolean),
    signals,
  };
}

export type ReferralRole = "buyer" | "seller";
export type ReferralPayoutMethod = "stripe_transfer" | "bank_transfer";

/**
 * Which rail a referrer's payout goes out on. Sellers are US-based by this
 * platform's own business model (Terms & Conditions §2 — MOVA connects
 * US-based sellers with Nigerian/Ghanaian/Togolese/Beninese buyers) and
 * seller_profiles.country has no edit UI yet (always null in practice
 * today), so an unset country falls back to that role default; an
 * explicitly-recorded country always wins once profile-country editing
 * exists.
 */
export function determinePayoutMethod(
  role: ReferralRole,
  country: string | null | undefined,
): ReferralPayoutMethod {
  const normalized = country?.trim().toUpperCase();
  if (normalized === "US" || normalized === "USA" || normalized === "UNITED STATES") {
    return "stripe_transfer";
  }
  if (normalized) {
    return "bank_transfer";
  }
  return role === "seller" ? "stripe_transfer" : "bank_transfer";
}
