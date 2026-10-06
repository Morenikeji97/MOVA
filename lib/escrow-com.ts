/**
 * ShipMova — Escrow.com API (https://www.escrow.com/api/docs).
 *
 * ShipMova never holds deal money. Two Escrow.com transactions per deal,
 * ShipMova the broker on both (founder's decision 2026-10-06):
 *   1. the car: buyer → Escrow.com → seller, released once the car passed
 *      inspection and the buyer's shipper has it with the title;
 *   2. shipping: buyer → Escrow.com → shipper, two milestones —
 *        inland (pickup to port), released at pickup;
 *        ocean freight, released at bill of lading.
 *      Each milestone has a 5-day inspection period: if the buyer does
 *      nothing after the shipper marks it done, Escrow.com releases it.
 * The buyer pays Escrow.com's fee on both, shown as its own line.
 *
 * Webhooks aren't signed, so a webhook only tells ShipMova which
 * transaction to re-fetch; nothing is trusted from its body.
 *
 * The builders and status mapping are pure (tested); only escrowFetch()
 * talks to Escrow.com.
 */

export const ESCROW_SANDBOX_URL = "https://api.escrow-sandbox.com/2017-09-01";
export const ESCROW_LIVE_URL = "https://api.escrow.com/2017-09-01";

/** Buyer's window to object after a shipping milestone is marked done. */
export const SHIPPING_MILESTONE_INSPECTION_DAYS = 5;
/** Buyer's window after the car is handed to the shipper (ShipMova's inspector has already checked it). */
export const CAR_INSPECTION_DAYS = 1;

const DAY_SECONDS = 86_400;

export type EscrowApiConfig = { base: string; email: string; apiKey: string; live: boolean };

/**
 * Escrow.com credentials from the environment, or null when not set up
 * (then staff record references by hand, as before). ESCROW_API_BASE must
 * be exactly the sandbox or live URL.
 */
export function escrowApiConfig(env: Record<string, string | undefined> = process.env): EscrowApiConfig | null {
  const base = (env.ESCROW_API_BASE ?? "").replace(/\/+$/, "");
  const email = env.ESCROW_API_EMAIL?.trim();
  const apiKey = env.ESCROW_API_KEY?.trim();
  if (!email || !apiKey) return null;
  if (base !== ESCROW_SANDBOX_URL && base !== ESCROW_LIVE_URL) return null;
  return { base, email, apiKey, live: base === ESCROW_LIVE_URL };
}

/** Whole dollars and cents, as Escrow.com expects amounts. */
function money(n: number): number {
  return Math.round(n * 100) / 100;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type Party = { role: "buyer" | "seller" | "broker"; customer: string; agreed?: boolean };

/** The car's transaction. */
export function buildCarTransaction(input: {
  reference: string;
  brokerEmail: string;
  buyerEmail: string;
  sellerEmail: string;
  priceUsd: number;
  vehicle: { year: number; make: string; model: string; vin: string; odometer: number | null };
}) {
  const { reference, brokerEmail, buyerEmail, sellerEmail, priceUsd, vehicle } = input;
  if (!(priceUsd > 0)) throw new Error("car price must be positive");
  const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}`.slice(0, 200);
  const parties: Party[] = [
    { role: "broker", customer: brokerEmail, agreed: true },
    { role: "buyer", customer: buyerEmail },
    { role: "seller", customer: sellerEmail },
  ];
  return {
    parties,
    currency: "usd",
    description: `ShipMova ${reference} — ${title} (VIN ${vehicle.vin})`.slice(0, 500),
    reference,
    items: [
      {
        reference: `${reference}-car`,
        title,
        description: `Vehicle sold through ShipMova ${reference}. Released to the seller after inspection and handover with the original title to the buyer's shipper.`.slice(0, 500),
        type: "motor_vehicle",
        category: "car",
        quantity: 1,
        inspection_period: CAR_INSPECTION_DAYS * DAY_SECONDS,
        shipping_type: "cargo_shipping",
        extra_attributes: {
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          vin: vehicle.vin,
          ...(vehicle.odometer != null ? { odometer: vehicle.odometer } : {}),
        },
        schedule: [{ amount: money(priceUsd), payer_customer: buyerEmail, beneficiary_customer: sellerEmail }],
        fees: [{ type: "escrow", payer_customer: buyerEmail, split: 1 }],
      },
    ],
  };
}

/** Inland + ocean split of a shipping price; the inland part must be 0 < inland < total. */
export function splitShippingPrice(totalUsd: number, inlandUsd: number): { inland: number; ocean: number } | null {
  if (!(totalUsd > 0) || !(inlandUsd > 0) || inlandUsd >= totalUsd) return null;
  return { inland: money(inlandUsd), ocean: money(totalUsd - inlandUsd) };
}

/** The shipping transaction: two milestones paid to the shipper. */
export function buildShippingTransaction(input: {
  reference: string;
  brokerEmail: string;
  buyerEmail: string;
  shipperEmail: string;
  inlandUsd: number;
  oceanUsd: number;
  vehicleLabel: string;
  route: string;
  today?: Date;
}) {
  const { reference, brokerEmail, buyerEmail, shipperEmail, inlandUsd, oceanUsd, vehicleLabel, route } = input;
  if (!(inlandUsd > 0) || !(oceanUsd > 0)) throw new Error("both milestones must be positive");
  const today = input.today ?? new Date();
  const due = (days: number) => isoDate(new Date(today.getTime() + days * DAY_SECONDS * 1000));
  const milestone = (suffix: string, title: string, description: string, amount: number, dueInDays: number) => ({
    reference: `${reference}-ship-${suffix}`,
    title: title.slice(0, 200),
    description: description.slice(0, 500),
    type: "milestone",
    category: "shipping",
    quantity: 1,
    inspection_period: SHIPPING_MILESTONE_INSPECTION_DAYS * DAY_SECONDS,
    schedule: [{ amount: money(amount), payer_customer: buyerEmail, beneficiary_customer: shipperEmail, due_date: due(dueInDays) }],
    fees: [{ type: "escrow", payer_customer: buyerEmail, split: 1 }],
  });
  const parties: Party[] = [
    { role: "broker", customer: brokerEmail, agreed: true },
    { role: "buyer", customer: buyerEmail },
    { role: "seller", customer: shipperEmail },
  ];
  return {
    parties,
    currency: "usd",
    description: `ShipMova ${reference} shipping — ${vehicleLabel}, ${route}`.slice(0, 500),
    reference: `${reference}-SHIP`,
    items: [
      milestone(
        "inland",
        `Inland transport — ${vehicleLabel}`,
        `Pickup in the U.S. and transport to the port. Released at pickup: the shipper marks it done after uploading pickup proof to ShipMova; released automatically ${SHIPPING_MILESTONE_INSPECTION_DAYS} days later unless the buyer objects.`,
        inlandUsd,
        14,
      ),
      milestone(
        "ocean",
        `Ocean freight — ${vehicleLabel}`,
        `Ocean freight, ${route}. Released at bill of lading: the shipper marks it done after uploading the bill of lading to ShipMova; released automatically ${SHIPPING_MILESTONE_INSPECTION_DAYS} days later unless the buyer objects.`,
        oceanUsd,
        45,
      ),
    ],
  };
}

/** What ShipMova shows for one Escrow.com item. */
export type EscrowItemState =
  | "awaiting_payment"
  | "funded"
  | "marked_done"
  | "released"
  | "in_dispute"
  | "rejected"
  | "cancelled";

type FetchedItem = {
  reference?: string;
  status?: Partial<Record<"shipped" | "received" | "accepted" | "rejected" | "canceled" | "in_dispute", boolean>>;
  schedule?: { status?: Partial<Record<"secured" | "payment_received" | "disbursed_to_beneficiary", boolean>> }[];
};

export function itemState(item: FetchedItem, transactionCancelled = false): EscrowItemState {
  const s = item.status ?? {};
  if (transactionCancelled || s.canceled) return "cancelled";
  if (s.in_dispute) return "in_dispute";
  if (s.rejected) return "rejected";
  if (s.accepted) return "released";
  if (s.shipped || s.received) return "marked_done";
  const secured = (item.schedule ?? []).some((x) => x.status?.secured || x.status?.payment_received);
  return secured ? "funded" : "awaiting_payment";
}

export const ITEM_STATE_LABEL: Record<EscrowItemState, string> = {
  awaiting_payment: "Waiting for the buyer's payment",
  funded: "Paid into Escrow.com",
  marked_done: `Marked done — releases in ${SHIPPING_MILESTONE_INSPECTION_DAYS} days unless the buyer objects`,
  released: "Released",
  in_dispute: "In dispute at Escrow.com",
  rejected: "Rejected by the buyer",
  cancelled: "Cancelled",
};

/** Escrow.com's escrow fee on a fetched transaction (what the buyer pays), if reported. */
export function escrowFeeUsd(transaction: { items?: { fees?: { type?: string; amount?: string | number }[] }[] }): number | null {
  let total = 0;
  let seen = false;
  for (const item of transaction.items ?? []) {
    for (const fee of item.fees ?? []) {
      if (fee.type === "escrow" && fee.amount != null) {
        total += Number(fee.amount);
        seen = true;
      }
    }
  }
  return seen ? money(total) : null;
}

/**
 * The transaction id named in an Escrow.com webhook body (the field varies
 * by event). Only a plain number is accepted; nothing else from the body is
 * used — the transaction is re-fetched from Escrow.com.
 */
export function webhookTransactionId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const nested = b.transaction && typeof b.transaction === "object" ? (b.transaction as Record<string, unknown>).id : null;
  const id = b.transaction_id ?? nested ?? b.id ?? null;
  if (typeof id === "number" && Number.isSafeInteger(id) && id > 0) return String(id);
  if (typeof id === "string" && /^\d{1,20}$/.test(id)) return id;
  return null;
}

/** Calls Escrow.com. Throws on network errors; returns status and parsed body otherwise. */
export async function escrowFetch(
  config: EscrowApiConfig,
  path: string,
  init: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {},
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const auth = Buffer.from(`${config.email}:${config.apiKey}`).toString("base64");
  const res = await fetch(`${config.base}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // keep the text
  }
  return { ok: res.ok, status: res.status, body };
}
