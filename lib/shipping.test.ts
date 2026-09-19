import { test } from "node:test";
import assert from "node:assert/strict";
import { compareRatesForBuyer, isLocalPickup } from "./shipping.ts";

// ---------------------------------------------------------------------------
// isLocalPickup
// ---------------------------------------------------------------------------

test("isLocalPickup: true when the shipper's service_areas includes the vehicle's state", () => {
  assert.equal(isLocalPickup(["CA", "NV"], "CA"), true);
});

test("isLocalPickup: false when the shipper's service_areas doesn't include the vehicle's state", () => {
  assert.equal(isLocalPickup(["NY", "NJ"], "CA"), false);
});

test("isLocalPickup: false with no vehicle state, no service_areas, or both missing", () => {
  assert.equal(isLocalPickup(["CA"], null), false);
  assert.equal(isLocalPickup(["CA"], undefined), false);
  assert.equal(isLocalPickup(null, "CA"), false);
  assert.equal(isLocalPickup(undefined, "CA"), false);
  assert.equal(isLocalPickup([], "CA"), false);
});

// ---------------------------------------------------------------------------
// compareRatesForBuyer — ranking/surfacing, never filtering
// ---------------------------------------------------------------------------

function rate(opts: {
  payment_status?: "good_standing" | "past_due" | "suspended";
  price?: number;
  service_areas?: string[];
}) {
  return {
    payment_status: opts.payment_status ?? "good_standing",
    price: opts.price ?? 1000,
    service_areas: opts.service_areas ?? [],
  };
}

test("a shipper with a matching service area sorts before one without, even at a higher price", () => {
  const local = rate({ service_areas: ["CA"], price: 1500 });
  const nonLocal = rate({ service_areas: ["NY"], price: 900 });
  const sorted = [nonLocal, local].sort((a, b) => compareRatesForBuyer(a, b, "CA"));
  assert.deepEqual(sorted, [local, nonLocal]);
});

test("a shipper without a matching service area still appears, just lower — never dropped", () => {
  const local = rate({ service_areas: ["CA"] });
  const nonLocal = rate({ service_areas: ["TX"] });
  const sorted = [local, nonLocal].sort((a, b) => compareRatesForBuyer(a, b, "CA"));
  assert.equal(sorted.length, 2);
  assert.equal(sorted[0], local);
  assert.equal(sorted[1], nonLocal);
});

test("within the same local/non-local group, good standing still beats past_due", () => {
  const localPastDue = rate({ service_areas: ["CA"], payment_status: "past_due", price: 500 });
  const localGoodStanding = rate({ service_areas: ["CA"], payment_status: "good_standing", price: 900 });
  const sorted = [localPastDue, localGoodStanding].sort((a, b) => compareRatesForBuyer(a, b, "CA"));
  assert.deepEqual(sorted, [localGoodStanding, localPastDue]);
});

test("within the same local/non-local and standing group, cheaper still wins", () => {
  const cheap = rate({ service_areas: ["CA"], price: 500 });
  const expensive = rate({ service_areas: ["CA"], price: 900 });
  const sorted = [expensive, cheap].sort((a, b) => compareRatesForBuyer(a, b, "CA"));
  assert.deepEqual(sorted, [cheap, expensive]);
});

test("with no vehicleState given, ordering is unchanged from the pre-existing standing/price rule", () => {
  const a = rate({ service_areas: ["CA"], payment_status: "past_due", price: 500 });
  const b = rate({ service_areas: [], payment_status: "good_standing", price: 900 });
  const sorted = [a, b].sort((x, y) => compareRatesForBuyer(x, y));
  assert.deepEqual(sorted, [b, a]);
});
