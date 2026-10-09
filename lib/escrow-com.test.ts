import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ESCROW_LIVE_URL,
  ESCROW_SANDBOX_URL,
  buildCarTransaction,
  buildShippingTransaction,
  escrowApiConfig,
  escrowFeeUsd,
  itemState,
  splitShippingPrice,
  webhookTransactionId,
} from "./escrow-com.ts";

test("credentials: only the exact sandbox or live URL, with email and key", () => {
  assert.equal(escrowApiConfig({}), null);
  assert.equal(escrowApiConfig({ ESCROW_API_BASE: ESCROW_SANDBOX_URL, ESCROW_API_EMAIL: "a@b.c" }), null);
  assert.equal(escrowApiConfig({ ESCROW_API_BASE: "https://evil.example", ESCROW_API_EMAIL: "a@b.c", ESCROW_API_KEY: "k" }), null);
  assert.deepEqual(escrowApiConfig({ ESCROW_API_BASE: `${ESCROW_SANDBOX_URL}/`, ESCROW_API_EMAIL: "a@b.c", ESCROW_API_KEY: "k" })?.live, false);
  assert.deepEqual(escrowApiConfig({ ESCROW_API_BASE: ESCROW_LIVE_URL, ESCROW_API_EMAIL: "a@b.c", ESCROW_API_KEY: "k" })?.live, true);
});

const car = buildCarTransaction({
  reference: "SM-000007",
  brokerEmail: "escrow@shipmova.com",
  buyerEmail: "buyer@example.com",
  sellerEmail: "seller@example.com",
  priceUsd: 12345.678,
  vehicle: { year: 2015, make: "Toyota", model: "Camry", vin: "4T1BF1FK5FU000000", odometer: 81234 },
});

test("car: buyer pays the price to the seller, ShipMova is broker, buyer pays the escrow fee", () => {
  assert.deepEqual(car.parties.map((p) => p.role).sort(), ["broker", "buyer", "seller"]);
  assert.equal(car.parties.find((p) => p.role === "broker")?.customer, "escrow@shipmova.com");
  const [item] = car.items;
  assert.equal(item.type, "motor_vehicle");
  assert.deepEqual(item.schedule, [{ amount: 12345.68, payer_customer: "buyer@example.com", beneficiary_customer: "seller@example.com" }]);
  assert.deepEqual(item.fees, [{ type: "escrow", payer_customer: "buyer@example.com", split: 1 }]);
  assert.equal(item.extra_attributes.vin, "4T1BF1FK5FU000000");
  // Nothing is ever paid to ShipMova through Escrow.com.
  assert.ok(!JSON.stringify(car).includes('"beneficiary_customer":"escrow@shipmova.com"'));
});

test("shipping: two milestones to the shipper, 5-day inspection, buyer pays the fee", () => {
  const ship = buildShippingTransaction({
    reference: "SM-000007",
    brokerEmail: "escrow@shipmova.com",
    buyerEmail: "buyer@example.com",
    shipperEmail: "shipper@example.com",
    inlandUsd: 600,
    oceanUsd: 1400,
    vehicleLabel: "2015 Toyota Camry",
    route: "Houston → Lagos",
    today: new Date("2026-10-06T12:00:00Z"),
  });
  assert.equal(ship.reference, "SM-000007-SHIP");
  assert.equal(ship.items.length, 2);
  const [inland, ocean] = ship.items;
  assert.equal(inland.type, "milestone");
  assert.equal(inland.schedule[0].amount, 600);
  assert.equal(ocean.schedule[0].amount, 1400);
  for (const m of ship.items) {
    assert.equal(m.inspection_period, 5 * 86_400);
    assert.equal(m.schedule[0].payer_customer, "buyer@example.com");
    assert.equal(m.schedule[0].beneficiary_customer, "shipper@example.com");
    assert.deepEqual(m.fees, [{ type: "escrow", payer_customer: "buyer@example.com", split: 1 }]);
  }
  assert.equal(inland.schedule[0].due_date, "2026-10-20");
  assert.equal(ocean.schedule[0].due_date, "2026-11-20");
  assert.match(inland.description, /Released at pickup/);
  assert.match(ocean.description, /Released at bill of lading/);
  assert.ok(!JSON.stringify(ship).includes('"beneficiary_customer":"escrow@shipmova.com"'));
});

test("inland/ocean split", () => {
  assert.deepEqual(splitShippingPrice(2000, 600), { inland: 600, ocean: 1400 });
  assert.equal(splitShippingPrice(2000, 0), null);
  assert.equal(splitShippingPrice(2000, 2000), null);
  assert.equal(splitShippingPrice(0, 10), null);
});

test("item state from a fetched transaction", () => {
  assert.equal(itemState({}), "awaiting_payment");
  assert.equal(itemState({ schedule: [{ status: { secured: true } }] }), "funded");
  assert.equal(itemState({ status: { shipped: true } }), "marked_done");
  assert.equal(itemState({ status: { shipped: true, accepted: true } }), "released");
  assert.equal(itemState({ status: { in_dispute: true, shipped: true } }), "in_dispute");
  assert.equal(itemState({ status: { rejected: true } }), "rejected");
  assert.equal(itemState({ status: { accepted: true } }, true), "cancelled");
});

test("escrow fee read from Escrow.com's own numbers", () => {
  assert.equal(escrowFeeUsd({ items: [{ fees: [{ type: "escrow", amount: "32.50" }] }, { fees: [{ type: "escrow", amount: 40 }] }] }), 72.5);
  assert.equal(escrowFeeUsd({ items: [{ fees: [{ type: "escrow" }] }] }), null);
});

test("webhook: only a numeric transaction id is taken from the body", () => {
  assert.equal(webhookTransactionId({ transaction_id: 123 }), "123");
  assert.equal(webhookTransactionId({ transaction: { id: "456" } }), "456");
  assert.equal(webhookTransactionId({ id: 789, event_type: "payment_received" }), "789");
  assert.equal(webhookTransactionId({ transaction_id: "1; drop table" }), null);
  assert.equal(webhookTransactionId({ transaction_id: -5 }), null);
  assert.equal(webhookTransactionId(null), null);
  assert.equal(webhookTransactionId("123"), null);
});
