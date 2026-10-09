/**
 * ShipMova — account deletion (Privacy Policy §9; migration 0069).
 * Deleting anonymises the account rather than erasing every row, because
 * deal, payment and policy-acceptance records must be kept (§8). This file
 * holds the copy shown to the person and the rules the actions share, so
 * what we say and what we do stay the same. No imports: node tests use it.
 */

export const DELETE_CONFIRM_WORD = "DELETE";

export const WHAT_IS_DELETED: readonly string[] = [
  "Your email address, phone and WhatsApp numbers",
  "Your name and ID check references",
  "Your listings (taken off ShipMova)",
  "Your waitlist sign-ups, saved cars and notifications",
  "Your contact details on shipments",
  "Your sign-in: you can't sign in again",
];

export const WHAT_IS_KEPT: readonly string[] = [
  "Records of completed deals, payments, disputes and reviews — no longer linked to your name or contact details",
  "Records that you accepted ShipMova's Terms and Privacy Policy",
];

/** Shown when a deal is still in progress (the database refuses: account_has_open_deals). */
export const OPEN_DEALS_MESSAGE =
  "Your account has a deal in progress (a reservation, shipment, inspection or open dispute). Finish or cancel it first, then ShipMova can delete your account.";

/** The person typed the confirmation word (case-insensitive, trimmed). */
export function confirmedDelete(typed: unknown): boolean {
  return typeof typed === "string" && typed.trim().toUpperCase() === DELETE_CONFIRM_WORD;
}

/** The database's refusal, as the admin sees it. */
export function anonymizeErrorMessage(dbMessage: string): string {
  if (dbMessage.includes("account_has_open_deals")) return OPEN_DEALS_MESSAGE.replace("Your account has", "This account has");
  if (dbMessage.includes("account_not_found")) return "this account wasn't found.";
  return dbMessage;
}

/**
 * Accounts this page never deletes: admins (removing staff is a developer
 * job, with its own checks). This is about the TARGET account — the person
 * pressing the button has already passed requireAdmin() with the code.
 */
export function isProtectedAccount(targetRole: string | null | undefined): boolean {
  return targetRole === "admin";
}
