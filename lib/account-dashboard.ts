/**
 * Where the header's "My dashboard" goes for a signed-in account (founder,
 * 2026-10-08). No imports beyond account-kind, so node tests can use it.
 *
 *   shipper / inspector login → its portal (lib/account-kind.ts)
 *   admin  → admin dashboard
 *   seller → My listings
 *   buyer  → buyer dashboard, or Verify your ID until their ID is verified
 *
 * A seller who is also a shipper keeps both: the portal first, then My
 * listings as an extra link.
 */
import { SERVICE_ACCOUNT_HOME, serviceAccountRedirect, type ServiceAccountKind } from "./account-kind.ts";
import { VERIFY_ID_PATH } from "./id-gate-paths.ts";

export type Destination = { label: string; href: string };

export type AccountDashboard = {
  /** The one "My dashboard" button. */
  primary: Destination;
  /** Anything else this account can open (a seller who is also a shipper). */
  extras: Destination[];
};

export function accountDashboard({
  role,
  kind,
  buyerVerified,
}: {
  role: string | null;
  kind: ServiceAccountKind | null;
  buyerVerified: boolean;
}): AccountDashboard {
  const sellerHome: Destination = { label: "My listings", href: "/seller/listings" };

  if (role === "admin") {
    return { primary: { label: "My dashboard", href: "/admin/dashboard" }, extras: [] };
  }
  if (kind) {
    return {
      primary: { label: "My dashboard", href: SERVICE_ACCOUNT_HOME[kind] },
      extras: role === "seller" ? [sellerHome] : [],
    };
  }
  if (role === "seller") {
    return { primary: { label: "My dashboard", href: sellerHome.href }, extras: [] };
  }
  if (role === "buyer") {
    return buyerVerified
      ? { primary: { label: "My dashboard", href: "/buyer/dashboard" }, extras: [] }
      : { primary: { label: "Verify your ID", href: VERIFY_ID_PATH }, extras: [] };
  }
  // No profile row yet (or it couldn't be read): somewhere that always works.
  return { primary: { label: "Browse vehicles", href: "/browse" }, extras: [] };
}

/**
 * Where a just-signed-in account lands (founder, 2026-10-15): its own
 * dashboard by default — the role they signed up as (accountDashboard above;
 * a shipper or inspector's own portal takes priority over an underlying
 * buyer/seller row, same as the header's "My dashboard") — or back to
 * `next` when sign-in was triggered by a specific action (e.g. "Make an
 * offer" on a car, a link in an email) rather than just opening /login or
 * the home page directly. `next` must already be a safe same-site path
 * (lib/auth-redirect.ts's safeNextPath).
 */
export function landingAfterSignIn({
  role,
  kind,
  buyerVerified,
  next,
}: {
  role: string | null;
  kind: ServiceAccountKind | null;
  buyerVerified: boolean;
  next: string | null;
}): string {
  const dashboard = accountDashboard({ role, kind, buyerVerified }).primary.href;
  if (!next || next === "/") return dashboard;
  if (kind && serviceAccountRedirect(kind, next.split("?")[0]!)) return dashboard;
  return next;
}
