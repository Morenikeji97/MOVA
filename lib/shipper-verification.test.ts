import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanFmcLicense, daysUntil, dueReminder, insuredBadge, isBookable, isInsured } from "./shipper-verification.ts";

const today = "2026-10-05";
const ok = {
  status: "approved",
  payment_status: "good_standing",
  coi_status: "approved" as const,
  coi_expires_on: "2027-01-01",
  license_status: "active" as const,
};

test("bookable needs approval, insurance in date and a checked license", () => {
  assert.equal(isBookable(ok, today), true);
  assert.equal(isBookable({ ...ok, status: "pending" }, today), false);
  assert.equal(isBookable({ ...ok, payment_status: "suspended" }, today), false);
  assert.equal(isBookable({ ...ok, coi_status: "pending" }, today), false);
  assert.equal(isBookable({ ...ok, license_status: "unchecked" }, today), false);
  assert.equal(isBookable({ ...ok, license_status: "not_found" }, today), false);
});

test("insurance expires at the end of its expiry day", () => {
  assert.equal(isInsured({ ...ok, coi_expires_on: today }, today), true);
  assert.equal(isInsured({ ...ok, coi_expires_on: "2026-10-04" }, today), false);
  assert.equal(isInsured({ ...ok, coi_expires_on: null }, today), false);
  assert.equal(daysUntil("2026-10-12", today), 7);
  assert.equal(daysUntil("2026-10-04", today), -1);
});

test("reminders at 30 days, 7 days and expiry, each once", () => {
  assert.equal(dueReminder("2026-12-01", today, null), null);
  assert.equal(dueReminder("2026-11-04", today, null), "30d");
  assert.equal(dueReminder("2026-11-04", today, "30d"), null);
  assert.equal(dueReminder("2026-10-12", today, "30d"), "7d");
  assert.equal(dueReminder("2026-10-12", today, null), "7d");
  assert.equal(dueReminder("2026-10-12", today, "7d"), null);
  assert.equal(dueReminder("2026-10-04", today, "7d"), "expired");
  assert.equal(dueReminder("2026-10-04", today, "expired"), null);
});

test("FMC license shapes", () => {
  assert.equal(cleanFmcLicense("023456N"), "023456N");
  assert.equal(cleanFmcLicense("fmc # 025123-nf"), "025123NF");
  assert.equal(cleanFmcLicense("OTI 19876F"), "19876F");
  assert.equal(cleanFmcLicense("ABC"), null);
  assert.equal(cleanFmcLicense("1234567890"), null);
});

test("badge", () => {
  assert.equal(
    insuredBadge({ ...ok, coi_cargo_limit_usd: "50000" }, today),
    "Insured ✓ — marine cargo cover up to $50,000, valid to 1 Jan 2027",
  );
  assert.equal(insuredBadge({ ...ok, coi_expires_on: "2026-01-01", coi_cargo_limit_usd: 1 }, today), null);
});
