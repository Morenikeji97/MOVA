/**
 * ShipMova — choosing an inspector for a deal (Day 4). Pure: the caller
 * loads the facts with the service role and passes them in.
 *
 * Hard exclusions (anti-collusion): an inspector is never sent to a car if
 * they ARE the seller or buyer, share a phone/WhatsApp number, sign-up IP or
 * device with the seller, have chatted with the seller, or have reserved
 * any of the seller's cars. They must serve the car's state, be approved,
 * and match the deal's test/real status (test inspectors only on test deals).
 * Soft rule (rotation): anyone who inspected this seller's cars in the last
 * 90 days is used only if nobody else is eligible — and that's flagged.
 * The pick among the eligible is uniformly random.
 */

export type InspectorCandidate = {
  id: string;
  userId: string;
  status: string;
  serviceStates: string[];
  isTest: boolean;
  phones: (string | null)[];
  signupIp: string | null;
  signupDevice: string | null;
  chattedWithSeller: boolean;
  reservedSellersCar: boolean;
  inspectedSellerRecently: boolean;
};

export type DealFacts = {
  sellerId: string;
  buyerId: string;
  vehicleState: string | null;
  isTestDeal: boolean;
  sellerPhones: (string | null)[];
  sellerSignupIp: string | null;
  sellerSignupDevice: string | null;
};

export type ExclusionReason =
  | "not_approved"
  | "test_mismatch"
  | "outside_service_area"
  | "is_seller_or_buyer"
  | "same_phone_as_seller"
  | "same_signup_ip_as_seller"
  | "same_device_as_seller"
  | "chatted_with_seller"
  | "reserved_sellers_car";

/** Digits only, last 10 (so +1 555… and 555… match). */
export function phoneKey(raw: string | null | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  return d.length >= 7 ? d.slice(-10) : null;
}

export function exclusionReason(c: InspectorCandidate, deal: DealFacts): ExclusionReason | null {
  if (c.status !== "approved") return "not_approved";
  if (c.isTest !== deal.isTestDeal) return "test_mismatch";
  if (!deal.vehicleState || !c.serviceStates.includes(deal.vehicleState)) return "outside_service_area";
  if (c.userId === deal.sellerId || c.userId === deal.buyerId) return "is_seller_or_buyer";
  const sellerPhones = new Set(deal.sellerPhones.map(phoneKey).filter(Boolean));
  if (c.phones.map(phoneKey).some((p) => p && sellerPhones.has(p))) return "same_phone_as_seller";
  if (c.signupIp && deal.sellerSignupIp && c.signupIp === deal.sellerSignupIp) return "same_signup_ip_as_seller";
  if (c.signupDevice && deal.sellerSignupDevice && c.signupDevice === deal.sellerSignupDevice) return "same_device_as_seller";
  if (c.chattedWithSeller) return "chatted_with_seller";
  if (c.reservedSellersCar) return "reserved_sellers_car";
  return null;
}

export type Assignment =
  | { ok: true; inspectorId: string; eligible: number; rotationRelaxed: boolean; excluded: Partial<Record<ExclusionReason, number>> }
  | { ok: false; eligible: 0; excluded: Partial<Record<ExclusionReason, number>> };

/** `random(n)` returns an integer in [0, n). */
export function chooseInspector(
  candidates: InspectorCandidate[],
  deal: DealFacts,
  random: (n: number) => number,
): Assignment {
  const excluded: Partial<Record<ExclusionReason, number>> = {};
  const passing: InspectorCandidate[] = [];
  for (const c of candidates) {
    const why = exclusionReason(c, deal);
    if (why) excluded[why] = (excluded[why] ?? 0) + 1;
    else passing.push(c);
  }
  if (passing.length === 0) return { ok: false, eligible: 0, excluded };
  const fresh = passing.filter((c) => !c.inspectedSellerRecently);
  const pool = fresh.length > 0 ? fresh : passing;
  const pick = pool[random(pool.length)];
  return { ok: true, inspectorId: pick.id, eligible: pool.length, rotationRelaxed: fresh.length === 0, excluded };
}

export const EXCLUSION_LABEL: Record<ExclusionReason, string> = {
  not_approved: "not approved",
  test_mismatch: "test/real mismatch",
  outside_service_area: "doesn't cover the car's state",
  is_seller_or_buyer: "is the seller or buyer",
  same_phone_as_seller: "same phone as the seller",
  same_signup_ip_as_seller: "signed up from the seller's network",
  same_device_as_seller: "signed up on the seller's device",
  chatted_with_seller: "has chatted with the seller",
  reserved_sellers_car: "has reserved one of the seller's cars",
};

/** The inspector's pay for a completed inspection: pct% of the car price, to the cent. */
export function inspectorPayUsd(carPriceUsd: number, pct = 2): number {
  return Math.round(carPriceUsd * pct) / 100;
}
