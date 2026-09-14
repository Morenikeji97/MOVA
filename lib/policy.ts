/**
 * MOVA Buyer Protection & Refund Policy — central version constant.
 *
 * Bump this whenever the policy content at /policies/buyer-protection
 * changes in a way that requires buyers/sellers to re-acknowledge it.
 *
 * Every acceptance — signup (buyer_profiles/seller_profiles.policy_version +
 * a public.policy_acceptances row) and per-reservation at fee-payment time
 * (another policy_acceptances row) — is stamped with whatever this constant
 * is at the moment of acceptance. Bumping it is the entire mechanism for
 * "requires re-acceptance": existing acceptances stay pinned to the old
 * version, so `buyer_profiles.policy_version <> CURRENT_POLICY_VERSION` (or
 * null) is how you'd find who still needs to be prompted.
 */
export const CURRENT_POLICY_VERSION = "v1.0";

export const BUYER_PROTECTION_POLICY_PATH = "/policies/buyer-protection";
