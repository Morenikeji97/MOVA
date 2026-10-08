/** Buyer ID gate routes (lib/id-verification.ts). No imports, so the
 * middleware and node tests can use it. */

export const VERIFY_ID_PATH = "/buyer/verify-id";

/**
 * What an unverified buyer can still reach: the ID step, sign-in/up and the
 * emailed-link routes, password reset, the legal pages they agreed to, and
 * the waitlist (where "ID verification opens at launch" points). Exact match
 * or prefix + "/".
 */
const ID_EXEMPT_PATHS = [
  VERIFY_ID_PATH,
  "/login",
  "/signup",
  "/auth",
  "/forgot-password",
  "/reset-password",
  "/terms",
  "/policies",
  "/waitlist",
  // Anyone may apply to be a shipper without a buyer ID. A login already
  // linked to a shipper skips this gate everywhere (lib/account-kind.ts);
  // nothing under /shipper is a buyer feature.
  "/shipper",
];

export function isIdExempt(path: string): boolean {
  return ID_EXEMPT_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}
