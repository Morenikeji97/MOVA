/**
 * MOVA Terms & Conditions — central version constant.
 *
 * Independent from lib/policy.ts's CURRENT_POLICY_VERSION (the Buyer
 * Protection & Refund Policy) — a user must accept both, not one instead of
 * the other.
 *
 * Every acceptance is a row in public.terms_acceptances stamped with
 * whatever this constant is at the moment of acceptance. Bumping it is the
 * entire mechanism for "requires re-acceptance, for every existing user, on
 * their next request": the middleware gate looks for a row matching this
 * exact version, so existing acceptances pinned to the old value stop
 * counting the moment this changes — no backfill/migration needed.
 */
export const CURRENT_TERMS_VERSION = "v1.0";

export const TERMS_EFFECTIVE_DATE = "2026-09-18";

export const TERMS_ACCEPT_PATH = "/terms/accept";
