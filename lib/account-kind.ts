/**
 * Shipper and inspector logins are "service accounts", not buyers (0065).
 * They sign in with ordinary buyer-role accounts, so the role alone can't
 * tell them apart: public.my_service_account_kind() does. A service account
 * is never sent to Verify your ID, lands on its own portal after sign-in,
 * can browse public pages, and can't reserve or chat as a buyer (refused by
 * the database). No imports, so the middleware and node tests can use it.
 */

// The database also returns "inspector" (0065 already refuses inspectors as
// buyers); the inspector portal arrives with the inspector role (#46), which
// adds it here.
export type ServiceAccountKind = "shipper";

export const SERVICE_ACCOUNT_HOME: Record<ServiceAccountKind, string> = {
  shipper: "/shipper/portal",
};

export const SERVICE_ACCOUNT_LABEL: Record<ServiceAccountKind, string> = {
  shipper: "Shipper portal",
};

/** What the RPC returned, or null for anything else (including an error). */
export function serviceAccountKind(value: unknown): ServiceAccountKind | null {
  return value === "shipper" ? value : null;
}

export const SERVICE_ACCOUNT_NOT_BUYER: Record<ServiceAccountKind, string> = {
  shipper:
    "Shipper accounts can't reserve cars or message sellers. To buy a car, sign up for a separate buyer account with another email.",
};

/** The database's refusal (0065 triggers), as raised. */
export const SERVICE_ACCOUNT_DB_ERROR = "service_account_not_buyer";

/** Buyer-only areas a service account is sent away from (exact or prefix + "/"). */
const BUYER_ONLY_PATHS = ["/buyer"];

/**
 * Where middleware sends a service account that opened `path`, or null to
 * let it through. Buyer-only areas (/buyer: dashboard, Verify your ID) go to
 * the account's own portal; public pages and everything else are untouched.
 */
export function serviceAccountRedirect(kind: ServiceAccountKind | null, path: string): string | null {
  if (!kind) return null;
  const buyerOnly = BUYER_ONLY_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
  return buyerOnly ? SERVICE_ACCOUNT_HOME[kind] : null;
}

/**
 * Where a just-signed-in user goes. A service account goes to its portal
 * unless it was heading somewhere else that's useful to it (any page that
 * isn't the home page or a buyer-only area); everyone else keeps `next`,
 * defaulting to the home page. `next` must already be a safe same-site path.
 */
export function landingAfterSignIn(kind: ServiceAccountKind | null, next: string | null): string {
  if (!kind) return next ?? "/";
  if (!next || next === "/" || serviceAccountRedirect(kind, next.split("?")[0])) {
    return SERVICE_ACCOUNT_HOME[kind];
  }
  return next;
}
