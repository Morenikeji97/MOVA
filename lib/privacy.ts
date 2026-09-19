/**
 * MOVA Privacy Policy — central version constant.
 *
 * Independent from lib/terms.ts's CURRENT_TERMS_VERSION — a user must
 * accept both, not one instead of the other. Shares the same mandatory
 * acceptance gate (see lib/supabase/middleware.ts and
 * app/terms/accept/page.tsx), which requires a current-version row in both
 * public.terms_acceptances and public.privacy_policy_acceptances before a
 * non-admin authenticated request proceeds.
 *
 * Every acceptance is a row in public.privacy_policy_acceptances stamped
 * with whatever this constant is at the moment of acceptance. Bumping it is
 * the entire mechanism for "requires re-acceptance, for every existing
 * user, on their next request" — see lib/terms.ts's doc comment for the
 * full mechanism, which this mirrors exactly.
 */
export const CURRENT_PRIVACY_VERSION = "v1.0";

export const PRIVACY_EFFECTIVE_DATE = "2026-09-18";
