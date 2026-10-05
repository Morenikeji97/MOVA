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
  // Shippers sign in with an ordinary (buyer-role) account — there's no
  // shipper role — so the shipper application, portal and dashboard must
  // work without a buyer ID. Nothing under /shipper is a buyer feature;
  // chat and reserving still check the ID server-side.
  "/shipper",
];

export function isIdExempt(path: string): boolean {
  return ID_EXEMPT_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}
