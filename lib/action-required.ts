/**
 * ShipMova — the admin "Action required" queue (founder, 2026-10-08): one
 * phone screen listing every deal or item waiting on ShipMova staff.
 *
 * Pure: app/admin/action-required/page.tsx loads the rows (admin with the
 * authenticator code, service role) and this turns them into items, so the
 * rules are testable and the page stays a plain list. No imports beyond
 * types, so node tests can use it.
 *
 * Each item says what to do, links to the screen where it's done, and shows
 * how long it has waited. An item past its target time is "Overdue"; a few
 * kinds (money in dispute, an overdue bill of lading) are always urgent.
 */

export type ActionKind =
  | "escrow_dispute"
  | "dispute"
  | "bank_transfer"
  | "car_escrow"
  | "shipping_escrow"
  | "bill_of_lading"
  | "inspection_review"
  | "inspection_assign"
  | "inspector_pay"
  | "reservation"
  | "listing"
  | "buyer_id"
  | "shipper"
  | "shipper_coi"
  | "inspector_application"
  | "account_deletion"
  | "review";

export type ActionGroup = "money" | "inspections" | "shipping" | "deals" | "listings" | "people" | "trust";

export const ACTION_GROUPS: readonly { group: ActionGroup; label: string }[] = [
  { group: "money", label: "Money & escrow" },
  { group: "inspections", label: "Inspections" },
  { group: "shipping", label: "Shipping" },
  { group: "deals", label: "Reservations" },
  { group: "listings", label: "Listings" },
  { group: "people", label: "IDs & partners" },
  { group: "trust", label: "Disputes & reviews" },
];

/** Per kind: its group, and how many hours it may wait before it's overdue (0 = urgent at once). */
export const ACTION_RULES: Record<ActionKind, { group: ActionGroup; targetHours: number }> = {
  escrow_dispute: { group: "money", targetHours: 0 },
  bank_transfer: { group: "money", targetHours: 24 },
  car_escrow: { group: "money", targetHours: 24 },
  shipping_escrow: { group: "money", targetHours: 24 },
  inspector_pay: { group: "money", targetHours: 7 * 24 },
  inspection_review: { group: "inspections", targetHours: 24 },
  inspection_assign: { group: "inspections", targetHours: 24 },
  bill_of_lading: { group: "shipping", targetHours: 0 },
  reservation: { group: "deals", targetHours: 24 },
  listing: { group: "listings", targetHours: 48 },
  buyer_id: { group: "people", targetHours: 24 },
  shipper: { group: "people", targetHours: 72 },
  shipper_coi: { group: "people", targetHours: 48 },
  inspector_application: { group: "people", targetHours: 72 },
  // Privacy Policy §9; the request page promises "usually within 3 days".
  account_deletion: { group: "people", targetHours: 72 },
  dispute: { group: "trust", targetHours: 48 },
  review: { group: "trust", targetHours: 72 },
};

/** A shipment still without a bill of lading this many days after pickup is overdue. */
export const BILL_OF_LADING_DUE_DAYS = 10;

export type ActionItem = {
  kind: ActionKind;
  /** Stable key for React lists. */
  key: string;
  /** What to do, e.g. "Review listing: 2015 Toyota Camry". */
  title: string;
  /** One line of context (reference, who, amount). */
  detail: string | null;
  href: string;
  /** When it started waiting (ISO). */
  since: string;
  /** Test account / test application: shown only when tests are included. */
  test: boolean;
};

export type RankedItem = ActionItem & { group: ActionGroup; ageHours: number; overdue: boolean };

const HOUR = 3600_000;

export function rankActions(items: readonly ActionItem[], now: Date): RankedItem[] {
  return items
    .map((i) => {
      const ageHours = Math.max(0, (now.getTime() - new Date(i.since).getTime()) / HOUR);
      const rule = ACTION_RULES[i.kind];
      return { ...i, group: rule.group, ageHours, overdue: ageHours >= rule.targetHours };
    })
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.ageHours - a.ageHours);
}

/** "3 h", "2 d" — how long it has waited. */
export function waitedLabel(ageHours: number): string {
  if (ageHours < 1) return "< 1 h";
  if (ageHours < 48) return `${Math.floor(ageHours)} h`;
  return `${Math.floor(ageHours / 24)} d`;
}

/**
 * A shipment that's past pickup with no bill-of-lading photo. `since` is the
 * last status change (the best record of pickup there is: it only moves
 * later), so this never fires early.
 */
export function billOfLadingOverdue(
  s: { shipping_status: string; shipping_status_updated_at: string | null },
  hasBillOfLading: boolean,
  now: Date,
): boolean {
  if (hasBillOfLading || !s.shipping_status_updated_at) return false;
  if (!["picked_up", "in_transit", "delivered"].includes(s.shipping_status)) return false;
  const days = (now.getTime() - new Date(s.shipping_status_updated_at).getTime()) / (24 * HOUR);
  return days >= BILL_OF_LADING_DUE_DAYS;
}

/** A reservation whose ShipMova fee is paid but that has no live inspection yet. */
export function needsInspector(
  pr: { mova_fee_payment_status: string; status: string },
  hasLiveInspection: boolean,
): boolean {
  return (
    pr.mova_fee_payment_status === "paid" &&
    ["submitted", "under_review", "verified"].includes(pr.status) &&
    !hasLiveInspection
  );
}
