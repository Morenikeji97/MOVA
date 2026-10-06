import { createAdminClient } from "@/lib/supabase/admin";
import type { EscrowItemState, EscrowStage } from "@/types/database";
import {
  buildCarTransaction,
  buildShippingTransaction,
  escrowApiConfig,
  escrowFeeUsd,
  escrowFetch,
  itemState,
  type EscrowApiConfig,
} from "@/lib/escrow-com";
import { ESCROW_STAGES } from "@/lib/escrow";

/**
 * Server-only Escrow.com operations (service role). Escrow.com is the source
 * of truth for money; ShipMova stores what it reports. Every write is read
 * back. Callers: admin actions (open / refresh) and the webhook route.
 */

type Admin = ReturnType<typeof createAdminClient>;
export type EscrowResult = { ok: true; message: string } | { ok: false; message: string };

const NOT_CONFIGURED = "Escrow.com isn't connected yet (ESCROW_API_* not set). Record the reference by hand.";

function errorText(body: unknown): string {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const msg = b.message ?? b.error ?? b.errors;
    if (msg) return typeof msg === "string" ? msg : JSON.stringify(msg).slice(0, 300);
  }
  return typeof body === "string" ? body.slice(0, 300) : "unknown error";
}

/** Moves the staff-facing stage forward only (never back). */
function laterStage(current: EscrowStage | null, candidate: EscrowStage): EscrowStage {
  const order = ESCROW_STAGES.map((s) => s.stage);
  return current && order.indexOf(current) >= order.indexOf(candidate) ? current : candidate;
}

type FetchedTransaction = {
  id?: number | string;
  is_cancelled?: boolean;
  items?: (Parameters<typeof itemState>[0] & { type?: string; fees?: { type?: string; amount?: string | number }[] })[];
};

async function fetchTransaction(config: EscrowApiConfig, id: string): Promise<FetchedTransaction | string> {
  const res = await escrowFetch(config, `/transaction/${encodeURIComponent(id)}`);
  if (!res.ok) return `Escrow.com said ${res.status}: ${errorText(res.body)}`;
  return res.body as FetchedTransaction;
}

/** Re-fetch one transaction from Escrow.com and record its state on the matching deal or shipment. */
export async function syncEscrowTransaction(transactionId: string, admin: Admin = createAdminClient()): Promise<EscrowResult> {
  const config = escrowApiConfig();
  if (!config) return { ok: false, message: NOT_CONFIGURED };
  const t = await fetchTransaction(config, transactionId);
  if (typeof t === "string") return { ok: false, message: t };
  const cancelled = Boolean(t.is_cancelled);
  const fee = escrowFeeUsd(t);
  const now = new Date().toISOString();

  const { data: deal } = await admin
    .from("purchase_requests")
    .select("id, escrow_stage")
    .eq("escrow_reference", transactionId)
    .maybeSingle();
  if (deal) {
    const car = (t.items ?? []).find((i) => i.type === "motor_vehicle") ?? (t.items ?? [])[0];
    const state: EscrowItemState = car ? itemState(car, cancelled) : cancelled ? "cancelled" : "awaiting_payment";
    let stage = deal.escrow_stage;
    if (state === "funded" || state === "marked_done") stage = laterStage(stage, "escrow_funded");
    if (state === "released") stage = laterStage(stage, "escrow_released");
    const res = await admin
      .from("purchase_requests")
      .update({ escrow_car_state: state, escrow_fee_usd: fee, escrow_synced_at: now, escrow_stage: stage })
      .eq("id", deal.id)
      .select("escrow_car_state");
    if (res.error || res.data?.[0]?.escrow_car_state !== state) {
      return { ok: false, message: `car escrow state not saved: ${res.error?.message ?? "no row"}` };
    }
    return { ok: true, message: `car: ${state}` };
  }

  const { data: shipment } = await admin
    .from("shipment_requests")
    .select("id")
    .eq("escrow_transaction_id", transactionId)
    .maybeSingle();
  if (shipment) {
    const find = (suffix: string) => (t.items ?? []).find((i) => (i.reference ?? "").endsWith(suffix));
    const inland = find("-ship-inland");
    const ocean = find("-ship-ocean");
    const inlandState: EscrowItemState = inland ? itemState(inland, cancelled) : "awaiting_payment";
    const oceanState: EscrowItemState = ocean ? itemState(ocean, cancelled) : "awaiting_payment";
    const res = await admin
      .from("shipment_requests")
      .update({ escrow_inland_state: inlandState, escrow_ocean_state: oceanState, escrow_fee_usd: fee, escrow_synced_at: now })
      .eq("id", shipment.id)
      .select("escrow_inland_state, escrow_ocean_state");
    if (res.error || res.data?.[0]?.escrow_inland_state !== inlandState || res.data?.[0]?.escrow_ocean_state !== oceanState) {
      return { ok: false, message: `shipping escrow state not saved: ${res.error?.message ?? "no row"}` };
    }
    return { ok: true, message: `shipping: inland ${inlandState}, ocean ${oceanState}` };
  }

  return { ok: false, message: "no ShipMova deal or shipment has this Escrow.com transaction" };
}

/** Opens the car's Escrow.com transaction for a reservation whose ShipMova fee is paid. */
export async function openCarEscrow(purchaseRequestId: string, admin: Admin = createAdminClient()): Promise<EscrowResult> {
  const config = escrowApiConfig();
  if (!config) return { ok: false, message: NOT_CONFIGURED };

  const { data: pr } = await admin
    .from("purchase_requests")
    .select("id, reference, buyer_id, vehicle_id, vehicle_price_usd, negotiated_price_usd, negotiated_price_status, mova_fee_payment_status, escrow_reference")
    .eq("id", purchaseRequestId)
    .maybeSingle();
  if (!pr) return { ok: false, message: "reservation not found" };
  if (pr.escrow_reference) return { ok: false, message: `escrow is already open (${pr.escrow_reference})` };
  if (pr.mova_fee_payment_status !== "paid") return { ok: false, message: "the buyer hasn't paid ShipMova's fee yet" };
  const price = pr.negotiated_price_status === "accepted" && pr.negotiated_price_usd != null
    ? Number(pr.negotiated_price_usd)
    : Number(pr.vehicle_price_usd);
  if (!(price > 0)) return { ok: false, message: "the reservation has no car price" };

  const { data: v } = await admin
    .from("vehicles")
    .select("seller_id, year, make, model, vin, mileage")
    .eq("id", pr.vehicle_id)
    .maybeSingle();
  if (!v?.vin) return { ok: false, message: "the car has no VIN on file" };
  const { data: people } = await admin.from("users").select("id, email").in("id", [pr.buyer_id, v.seller_id]);
  const email = (id: string) => people?.find((p) => p.id === id)?.email ?? null;
  const buyerEmail = email(pr.buyer_id);
  const sellerEmail = email(v.seller_id);
  if (!buyerEmail || !sellerEmail) return { ok: false, message: "buyer or seller email missing" };

  const payload = buildCarTransaction({
    reference: pr.reference ?? pr.id,
    brokerEmail: config.email,
    buyerEmail,
    sellerEmail,
    priceUsd: price,
    vehicle: { year: v.year, make: v.make, model: v.model, vin: v.vin, odometer: v.mileage ?? null },
  });
  const res = await escrowFetch(config, "/transaction", { method: "POST", body: payload });
  const id = (res.body as { id?: number | string } | null)?.id;
  if (!res.ok || id == null) return { ok: false, message: `Escrow.com refused: ${res.status} ${errorText(res.body)}` };

  const saved = await admin
    .from("purchase_requests")
    .update({ escrow_reference: String(id), escrow_stage: "escrow_opened", escrow_car_state: "awaiting_payment", escrow_synced_at: new Date().toISOString() })
    .eq("id", pr.id)
    .is("escrow_reference", null)
    .select("escrow_reference");
  if (saved.error || saved.data?.[0]?.escrow_reference !== String(id)) {
    return { ok: false, message: `Escrow.com transaction ${id} was created but not saved here — record it by hand. ${saved.error?.message ?? ""}` };
  }
  const synced = await syncEscrowTransaction(String(id), admin);
  return { ok: true, message: `Car escrow opened at Escrow.com (${id}). Escrow.com emails the buyer and seller to agree.${synced.ok ? "" : ` Refresh failed: ${synced.message}`}` };
}

/** Opens the shipping escrow (two milestones) for a shipment with an inland/ocean split. */
export async function openShippingEscrow(shipmentId: string, admin: Admin = createAdminClient()): Promise<EscrowResult> {
  const config = escrowApiConfig();
  if (!config) return { ok: false, message: NOT_CONFIGURED };

  const { data: s } = await admin
    .from("shipment_requests")
    .select("id, buyer_id, shipper_id, purchase_request_id, inland_usd, ocean_usd, escrow_transaction_id, vehicle_year, vehicle_make, vehicle_model, pickup_state, shipping_rate_id")
    .eq("id", shipmentId)
    .maybeSingle();
  if (!s) return { ok: false, message: "shipment not found" };
  if (s.escrow_transaction_id) return { ok: false, message: `shipping escrow is already open (${s.escrow_transaction_id})` };
  if (!(Number(s.inland_usd) > 0) || !(Number(s.ocean_usd) > 0)) {
    return { ok: false, message: "this shipment has no inland/ocean split — the shipper must set the inland portion on their rate" };
  }
  const [{ data: buyer }, { data: shipper }, { data: pr }, { data: rate }] = await Promise.all([
    admin.from("users").select("email").eq("id", s.buyer_id).maybeSingle(),
    admin.from("shippers").select("contact_email").eq("id", s.shipper_id).maybeSingle(),
    s.purchase_request_id
      ? admin.from("purchase_requests").select("reference").eq("id", s.purchase_request_id).maybeSingle()
      : Promise.resolve({ data: null }),
    s.shipping_rate_id
      ? admin.from("shipping_rates").select("origin_port, origin_region, destination_country").eq("id", s.shipping_rate_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!buyer?.email || !shipper?.contact_email) return { ok: false, message: "buyer or shipper email missing" };

  const vehicleLabel = [s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ") || "Vehicle";
  const route = `${rate?.origin_port || rate?.origin_region || s.pickup_state || "U.S."} → ${rate?.destination_country ?? "destination"}`;
  const payload = buildShippingTransaction({
    reference: pr?.reference ?? s.id,
    brokerEmail: config.email,
    buyerEmail: buyer.email,
    shipperEmail: shipper.contact_email,
    inlandUsd: Number(s.inland_usd),
    oceanUsd: Number(s.ocean_usd),
    vehicleLabel,
    route,
  });
  const res = await escrowFetch(config, "/transaction", { method: "POST", body: payload });
  const id = (res.body as { id?: number | string } | null)?.id;
  if (!res.ok || id == null) return { ok: false, message: `Escrow.com refused: ${res.status} ${errorText(res.body)}` };

  const saved = await admin
    .from("shipment_requests")
    .update({ escrow_transaction_id: String(id), escrow_inland_state: "awaiting_payment", escrow_ocean_state: "awaiting_payment", escrow_synced_at: new Date().toISOString() })
    .eq("id", s.id)
    .is("escrow_transaction_id", null)
    .select("escrow_transaction_id");
  if (saved.error || saved.data?.[0]?.escrow_transaction_id !== String(id)) {
    return { ok: false, message: `Escrow.com transaction ${id} was created but not saved here — tell the developer. ${saved.error?.message ?? ""}` };
  }
  const synced = await syncEscrowTransaction(String(id), admin);
  return { ok: true, message: `Shipping escrow opened at Escrow.com (${id}). Escrow.com emails the buyer and shipper to agree.${synced.ok ? "" : ` Refresh failed: ${synced.message}`}` };
}
