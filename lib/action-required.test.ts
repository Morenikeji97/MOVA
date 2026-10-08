import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ACTION_GROUPS,
  ACTION_RULES,
  BILL_OF_LADING_DUE_DAYS,
  billOfLadingOverdue,
  needsInspector,
  rankActions,
  waitedLabel,
  type ActionItem,
} from "./action-required.ts";

// Founder, 2026-10-08: one phone screen listing every deal/item that needs
// the founder — pending listings, buyer IDs, shippers, inspections, escrow
// steps, disputes, overdue bills of lading.

const now = new Date("2026-10-08T12:00:00Z");
const item = (kind: ActionItem["kind"], hoursAgo: number, key: string = kind): ActionItem => ({
  kind,
  key,
  title: kind,
  detail: null,
  href: "/admin/dashboard",
  since: new Date(now.getTime() - hoursAgo * 3600_000).toISOString(),
  test: false,
});

test("overdue first, then oldest first", () => {
  const ranked = rankActions([item("listing", 10), item("buyer_id", 30), item("review", 5), item("listing", 60, "old")], now);
  assert.deepEqual(
    ranked.map((r) => [r.key, r.overdue]),
    [
      ["old", true],
      ["buyer_id", true],
      ["listing", false],
      ["review", false],
    ],
  );
});

test("money in dispute and overdue bills of lading are urgent at once", () => {
  assert.equal(rankActions([item("escrow_dispute", 0)], now)[0].overdue, true);
  assert.equal(rankActions([item("bill_of_lading", 0)], now)[0].overdue, true);
});

test("every kind belongs to a listed group", () => {
  const groups = new Set(ACTION_GROUPS.map((g) => g.group));
  for (const [kind, rule] of Object.entries(ACTION_RULES)) assert.ok(groups.has(rule.group), kind);
});

test("bill of lading: overdue only after the due days, past pickup, and without a photo", () => {
  const at = (days: number) => new Date(now.getTime() - days * 86400_000).toISOString();
  const s = (status: string, days: number) => ({ shipping_status: status, shipping_status_updated_at: at(days) });
  assert.equal(billOfLadingOverdue(s("picked_up", BILL_OF_LADING_DUE_DAYS + 1), false, now), true);
  assert.equal(billOfLadingOverdue(s("picked_up", BILL_OF_LADING_DUE_DAYS - 1), false, now), false);
  assert.equal(billOfLadingOverdue(s("picked_up", 30), true, now), false);
  assert.equal(billOfLadingOverdue(s("awaiting_pickup", 30), false, now), false);
});

test("a fee-paid open reservation without an inspection needs an inspector", () => {
  assert.equal(needsInspector({ mova_fee_payment_status: "paid", status: "under_review" }, false), true);
  assert.equal(needsInspector({ mova_fee_payment_status: "paid", status: "under_review" }, true), false);
  assert.equal(needsInspector({ mova_fee_payment_status: "unpaid", status: "under_review" }, false), false);
  assert.equal(needsInspector({ mova_fee_payment_status: "paid", status: "cancelled" }, false), false);
});

test("waited label", () => {
  assert.equal(waitedLabel(0.2), "< 1 h");
  assert.equal(waitedLabel(5.9), "5 h");
  assert.equal(waitedLabel(72), "3 d");
});

test("the page is admin-only with the authenticator code, and leaves test data out by default", () => {
  const src = readFileSync("app/admin/action-required/page.tsx", "utf8");
  assert.match(src, /await requireAdmin\(\)/);
  assert.ok(src.indexOf("requireAdmin()") < src.indexOf("loadActionItems()"), "admin check before the service-role loader");
  assert.match(src, /showTests/);
});
