import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseInspector, exclusionReason, inspectorPayUsd, phoneKey, type DealFacts, type InspectorCandidate } from "./inspector-assignment.ts";
import { distanceMeters, photoFlags } from "./inspection-checks.ts";

const deal: DealFacts = {
  sellerId: "seller",
  buyerId: "buyer",
  vehicleState: "TX",
  isTestDeal: false,
  sellerPhones: ["+1 (555) 123-4567", null],
  sellerSignupIp: "1.2.3.4",
  sellerSignupDevice: "dev-seller",
};
const ok = (over: Partial<InspectorCandidate> = {}): InspectorCandidate => ({
  id: "i1",
  userId: "u1",
  status: "approved",
  serviceStates: ["TX"],
  isTest: false,
  phones: ["+1 555 999 0000"],
  signupIp: "9.9.9.9",
  signupDevice: "dev-other",
  chattedWithSeller: false,
  reservedSellersCar: false,
  inspectedSellerRecently: false,
  ...over,
});

test("anti-collusion: each hard rule excludes", () => {
  assert.equal(exclusionReason(ok(), deal), null);
  assert.equal(exclusionReason(ok({ userId: "seller" }), deal), "is_seller_or_buyer");
  assert.equal(exclusionReason(ok({ userId: "buyer" }), deal), "is_seller_or_buyer");
  assert.equal(exclusionReason(ok({ phones: ["555-123-4567"] }), deal), "same_phone_as_seller");
  assert.equal(exclusionReason(ok({ signupIp: "1.2.3.4" }), deal), "same_signup_ip_as_seller");
  assert.equal(exclusionReason(ok({ signupDevice: "dev-seller" }), deal), "same_device_as_seller");
  assert.equal(exclusionReason(ok({ chattedWithSeller: true }), deal), "chatted_with_seller");
  assert.equal(exclusionReason(ok({ reservedSellersCar: true }), deal), "reserved_sellers_car");
  assert.equal(exclusionReason(ok({ serviceStates: ["CA"] }), deal), "outside_service_area");
  assert.equal(exclusionReason(ok({ status: "pending" }), deal), "not_approved");
  assert.equal(exclusionReason(ok({ isTest: true }), deal), "test_mismatch");
  assert.equal(exclusionReason(ok({ signupIp: null }), { ...deal, sellerSignupIp: null }), null);
});

test("phone matching ignores formatting and country code", () => {
  assert.equal(phoneKey("+1 (555) 123-4567"), "5551234567");
  assert.equal(phoneKey("555.123.4567"), "5551234567");
  assert.equal(phoneKey("12"), null);
});

test("random pick only among the eligible; rotation is soft", () => {
  const cands = [ok({ id: "a" }), ok({ id: "b", chattedWithSeller: true }), ok({ id: "c", inspectedSellerRecently: true }), ok({ id: "d" })];
  const seen = new Set<string>();
  for (let n = 0; n < 2; n++) {
    const r = chooseInspector(cands, deal, () => n);
    assert.ok(r.ok);
    if (r.ok) {
      seen.add(r.inspectorId);
      assert.equal(r.eligible, 2);
      assert.equal(r.rotationRelaxed, false);
      assert.deepEqual(r.excluded, { chatted_with_seller: 1 });
    }
  }
  assert.deepEqual([...seen].sort(), ["a", "d"]);
  const onlyRecent = chooseInspector([ok({ id: "c", inspectedSellerRecently: true })], deal, () => 0);
  assert.ok(onlyRecent.ok && onlyRecent.rotationRelaxed && onlyRecent.inspectorId === "c");
  const none = chooseInspector([ok({ userId: "seller" })], deal, () => 0);
  assert.deepEqual(none, { ok: false, eligible: 0, excluded: { is_seller_or_buyer: 1 } });
});

test("pay is 2% of the car price to the cent", () => {
  assert.equal(inspectorPayUsd(12345.67), 246.91);
  assert.equal(inspectorPayUsd(10000), 200);
});

const at = "2026-10-06T15:00:00Z";
const photo = (kind: "vin" | "odometer" | "title" | "car", lat: number | null, lng: number | null, t = "2026-10-06T16:00:00Z", acc = 10) => ({
  kind,
  latitude: lat,
  longitude: lng,
  accuracyM: acc,
  capturedAt: t,
});

test("photo checks: complete, located, close together, after assignment", () => {
  assert.deepEqual(photoFlags([photo("vin", 29.76, -95.37), photo("odometer", 29.7601, -95.3701), photo("title", 29.76, -95.37)], at), []);
  assert.deepEqual(photoFlags([photo("vin", 29.76, -95.37)], at).sort(), ["missing_odometer_photo", "missing_title_photo"]);
  assert.ok(photoFlags([photo("vin", null, null), photo("odometer", 29.76, -95.37), photo("title", 29.76, -95.37)], at).includes("photo_without_location"));
  assert.ok(photoFlags([photo("vin", 29.76, -95.37), photo("odometer", 30.27, -97.74), photo("title", 29.76, -95.37)], at).includes("photos_far_apart"));
  assert.ok(photoFlags([photo("vin", 29.76, -95.37), photo("odometer", 29.76, -95.37, "2026-10-06T22:00:00Z"), photo("title", 29.76, -95.37)], at).includes("photos_hours_apart"));
  assert.ok(photoFlags([photo("vin", 29.76, -95.37, "2026-10-06T14:00:00Z"), photo("odometer", 29.76, -95.37), photo("title", 29.76, -95.37)], at).includes("photo_before_assignment"));
  assert.ok(photoFlags([photo("vin", 29.76, -95.37, undefined, 500), photo("odometer", 29.76, -95.37), photo("title", 29.76, -95.37)], at).includes("low_location_accuracy"));
  assert.ok(Math.abs(distanceMeters({ lat: 29.76, lng: -95.37 }, { lat: 30.27, lng: -97.74 }) - 235_000) < 5_000);
});
