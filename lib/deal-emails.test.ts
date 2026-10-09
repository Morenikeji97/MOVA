import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ESCROW_STAGE_EVENT, dealEmails, type DealEvent } from "./deal-emails.ts";

// Founder, 2026-10-09: email notifications at every deal stage — buyer,
// seller, shipper, inspector.

const EVENTS: DealEvent[] = [
  "reservation_submitted", "reservation_under_review", "reservation_released", "fee_requested", "fee_paid",
  "escrow_opened", "escrow_funded", "inspection_assigned", "inspection_passed", "inspection_failed",
  "handed_to_shipper", "escrow_released", "shipment_created", "shipping_escrow_opened",
  "picked_up", "in_transit", "delivered", "inspector_paid",
];
const ctx = { reference: "SM-000001", car: "2015 Toyota Camry", shipper: "Test Shipping Co", payUsd: 300 };

test("every deal event emails someone, naming the deal and the car", () => {
  for (const e of EVENTS) {
    const mails = dealEmails(e, ctx);
    assert.ok(mails.length > 0, e);
    for (const m of mails) {
      assert.match(m.subject, /SM-000001/, `${e} → ${m.to}`);
      assert.ok(m.lines.join(" ").includes("2015 Toyota Camry") || m.subject.includes("2015 Toyota Camry"), `${e} → ${m.to}`);
      assert.match(m.cta.path, /^\//, e);
    }
  }
});

test("each role hears about the stages that concern them", () => {
  const roles = (e: DealEvent) => dealEmails(e, ctx).map((m) => m.to).sort();
  assert.deepEqual(roles("reservation_submitted"), ["buyer", "seller"]);
  assert.deepEqual(roles("escrow_funded"), ["buyer", "seller"]);
  assert.deepEqual(roles("inspection_assigned"), ["inspector"]);
  assert.deepEqual(roles("inspection_passed"), ["buyer", "inspector", "seller"]);
  assert.deepEqual(roles("shipment_created"), ["shipper"]);
  assert.deepEqual(roles("shipping_escrow_opened"), ["buyer", "shipper"]);
  assert.deepEqual(roles("delivered"), ["buyer"]);
  assert.deepEqual(roles("inspector_paid"), ["inspector"]);
});

test("every step where the buyer pays carries the scam warning", () => {
  for (const e of ["fee_requested", "escrow_opened", "shipping_escrow_opened"] as const) {
    const buyer = dealEmails(e, ctx).find((m) => m.to === "buyer")!;
    assert.ok(buyer.lines.some((l) => /never send you bank details/.test(l)), e);
  }
});

test("no deal email asks anyone to pay a person or ShipMova for the car", () => {
  for (const e of EVENTS) {
    for (const m of dealEmails(e, ctx)) {
      const text = m.lines.join(" ");
      assert.doesNotMatch(text, /pay the seller directly|send money to/i, e);
    }
  }
});

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(f) && !f.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

test("every event is actually sent from somewhere", () => {
  const src = [...walk("app"), ...walk("lib")].map((f) => readFileSync(f, "utf8")).join("\n");
  const viaStage = new Set(Object.values(ESCROW_STAGE_EVENT));
  const viaShippingStatus = new Set<DealEvent>(["picked_up", "in_transit", "delivered"]);
  for (const e of EVENTS) {
    if (viaStage.has(e) && /ESCROW_STAGE_EVENT\[stage\]/.test(src)) continue;
    if (viaShippingStatus.has(e) && /notifyDealEvent\(shippingStatus/.test(src)) continue;
    const literal = new RegExp(`notifyDealEvent\\([^)]*"${e}"`);
    assert.ok(literal.test(src), `${e} is never sent`);
  }
});
