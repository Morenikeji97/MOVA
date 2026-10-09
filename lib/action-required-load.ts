import { createAdminClient } from "@/lib/supabase/admin";
import { loadTestIds } from "@/lib/test-accounts";
import {
  BILL_OF_LADING_DUE_DAYS,
  billOfLadingOverdue,
  needsInspector,
  type ActionItem,
} from "@/lib/action-required";

/** Rows read per source; the page says when a source failed. */
const LIMIT = 50;

const OPEN_DEAL = ["submitted", "under_review", "verified"];

/**
 * Loads everything waiting on ShipMova staff (lib/action-required.ts has the
 * rules). Service role: callers MUST have passed requireAdmin() (admin with
 * the authenticator code) first. Returns every item, test ones flagged, and
 * the sources that failed to load — a failed source must never read as
 * "nothing to do".
 */
export async function loadActionItems(): Promise<{ items: ActionItem[]; failed: string[] }> {
  // Admin with the authenticator code (requireAdmin): the service role reads
  // the columns the admin pages already show.
  const db = createAdminClient();
  const test = await loadTestIds(db);
  const testUsers = new Set(test.userIds);
  const testShippers = new Set(test.shipperIds);

  const [
    deals,
    shipments,
    inspections,
    listings,
    buyerIds,
    shippers,
    inspectorApps,
    disputes,
    deletions,
    reviews,
  ] = await Promise.all([
    db
      .from("purchase_requests")
      .select(
        "id, reference, vehicle_id, buyer_id, status, created_at, updated_at, mova_fee_payment_status, bank_transfer_proof_uploaded_at, escrow_stage, escrow_car_state",
      )
      .or(
        "status.eq.submitted,mova_fee_payment_status.eq.pending_manual_verification,escrow_car_state.eq.in_dispute,and(mova_fee_payment_status.eq.paid,status.in.(submitted,under_review,verified))",
      )
      .order("created_at", { ascending: true })
      .limit(LIMIT * 2),
    db
      .from("shipment_requests")
      .select(
        "id, buyer_id, shipper_id, status, created_at, shipping_status, shipping_status_updated_at, vehicle_year, vehicle_make, vehicle_model, escrow_transaction_id, escrow_inland_state, escrow_ocean_state, shipper_company_name",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(LIMIT),
    db
      .from("inspections")
      .select("id, purchase_request_id, status, submitted_at, decided_at, pay_status, pay_usd, assigned_at")
      .in("status", ["assigned", "submitted", "passed", "failed"])
      .limit(LIMIT * 2),
    db
      .from("vehicles")
      .select("id, seller_id, year, make, model, trim, updated_at")
      .eq("status", "pending_review")
      .order("updated_at", { ascending: true })
      .limit(LIMIT),
    db
      .from("buyer_profiles")
      .select("user_id, id_country, id_method, id_name_match, created_at")
      .eq("verification_status", "pending")
      .not("id_method", "is", null)
      .order("created_at", { ascending: true })
      .limit(LIMIT),
    db
      .from("shippers")
      .select("id, company_name, status, is_test, created_at, coi_status, coi_submitted_at")
      .or("status.eq.pending,coi_status.eq.pending")
      .order("created_at", { ascending: true })
      .limit(LIMIT),
    db
      .from("inspectors")
      .select("id, full_name, is_test, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(LIMIT),
    db
      .from("disputes")
      .select("id, purchase_request_id, reporter_id, category, status, created_at")
      .in("status", ["open", "approved_pending_refund"])
      .order("created_at", { ascending: true })
      .limit(LIMIT),
    db
      .from("account_deletion_requests")
      .select("id, user_id, requested_at")
      .eq("status", "pending")
      .order("requested_at", { ascending: true })
      .limit(LIMIT),
    db
      .from("reviews")
      .select("id, reviewer_id, status, created_at")
      .in("status", ["pending", "flagged"])
      .order("created_at", { ascending: true })
      .limit(LIMIT),
  ]);

  // A source that failed to load must never look like "nothing to do".
  const failed = [
    ["reservations", deals.error],
    ["shipments", shipments.error],
    ["inspections", inspections.error],
    ["listings", listings.error],
    ["buyer IDs", buyerIds.error],
    ["shippers", shippers.error],
    ["inspector applications", inspectorApps.error],
    ["disputes", disputes.error],
    ["account deletions", deletions.error],
    ["reviews", reviews.error],
  ].flatMap(([label, err]) => {
    if (!err) return [];
    console.error(`action required: ${label} failed:`, err);
    return [label as string];
  });

  // Labels: cars for deals and inspections, bill-of-lading photos for shipments.
  const dealRows = deals.data ?? [];
  const inspectionRows = inspections.data ?? [];
  const shipmentRows = shipments.data ?? [];
  const extraDealIds = inspectionRows
    .map((i) => i.purchase_request_id)
    .filter((id) => !dealRows.some((d) => d.id === id));
  const [{ data: extraDeals }, { data: bolRows }] = await Promise.all([
    extraDealIds.length
      ? db.from("purchase_requests").select("id, reference, vehicle_id, buyer_id").in("id", extraDealIds)
      : Promise.resolve({ data: [] as { id: string; reference: string | null; vehicle_id: string; buyer_id: string }[] }),
    shipmentRows.length
      ? db
          .from("shipment_proof_photos")
          .select("shipment_request_id")
          .eq("kind", "bill_of_lading")
          .in(
            "shipment_request_id",
            shipmentRows.map((s) => s.id),
          )
      : Promise.resolve({ data: [] as { shipment_request_id: string }[] }),
  ]);
  const dealById = new Map(
    [...dealRows, ...(extraDeals ?? [])].map((d) => [d.id, d as { id: string; reference: string | null; vehicle_id: string; buyer_id: string }]),
  );
  const vehicleIds = [...new Set([...dealById.values()].map((d) => d.vehicle_id))];
  const { data: cars } = vehicleIds.length
    ? await db.from("vehicles").select("id, year, make, model").in("id", vehicleIds)
    : { data: [] as { id: string; year: number; make: string; model: string }[] };
  const carById = new Map((cars ?? []).map((c) => [c.id, `${c.year} ${c.make} ${c.model}`]));
  const dealLabel = (id: string) => {
    const d = dealById.get(id);
    if (!d) return "a deal";
    return [d.reference, carById.get(d.vehicle_id)].filter(Boolean).join(" · ");
  };
  const hasBol = new Set((bolRows ?? []).map((p) => p.shipment_request_id));
  const liveInspection = new Set(
    inspectionRows.filter((i) => ["assigned", "submitted", "passed"].includes(i.status)).map((i) => i.purchase_request_id),
  );
  const now = new Date();

  const items: ActionItem[] = [];

  for (const d of dealRows) {
    const isTest = testUsers.has(d.buyer_id);
    const label = dealLabel(d.id);
    if (d.escrow_car_state === "in_dispute") {
      items.push({ kind: "escrow_dispute", key: `ed-${d.id}`, title: "Car escrow is in dispute at Escrow.com", detail: label, href: "/admin/reservations", since: d.updated_at, test: isTest });
    }
    if (d.mova_fee_payment_status === "pending_manual_verification") {
      items.push({ kind: "bank_transfer", key: `bt-${d.id}`, title: "Confirm a bank transfer for the ShipMova fee", detail: label, href: "/admin/reservations", since: d.bank_transfer_proof_uploaded_at ?? d.updated_at, test: isTest });
    }
    if (d.status === "submitted") {
      items.push({ kind: "reservation", key: `rs-${d.id}`, title: "Review a new reservation", detail: label, href: "/admin/reservations", since: d.created_at, test: isTest });
    }
    if (d.mova_fee_payment_status === "paid" && OPEN_DEAL.includes(d.status) && !d.escrow_stage) {
      items.push({ kind: "car_escrow", key: `ce-${d.id}`, title: "Open the car escrow (fee paid)", detail: label, href: "/admin/reservations", since: d.updated_at, test: isTest });
    }
    if (needsInspector(d, liveInspection.has(d.id))) {
      items.push({ kind: "inspection_assign", key: `ia-${d.id}`, title: "Assign an inspector", detail: label, href: "/admin/reservations", since: d.updated_at, test: isTest });
    }
  }

  for (const s of shipmentRows) {
    const isTest = testUsers.has(s.buyer_id) || testShippers.has(s.shipper_id);
    const car = [s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ") || "Shipment";
    const detail = [car, s.shipper_company_name].filter(Boolean).join(" · ");
    if (s.escrow_inland_state === "in_dispute" || s.escrow_ocean_state === "in_dispute") {
      items.push({ kind: "escrow_dispute", key: `sd-${s.id}`, title: "Shipping escrow is in dispute at Escrow.com", detail, href: "/admin/shipments", since: s.shipping_status_updated_at ?? s.created_at, test: isTest });
    }
    if (!s.escrow_transaction_id) {
      items.push({ kind: "shipping_escrow", key: `se-${s.id}`, title: "Open the shipping escrow", detail, href: "/admin/shipments", since: s.created_at, test: isTest });
    }
    if (billOfLadingOverdue(s, hasBol.has(s.id), now)) {
      items.push({ kind: "bill_of_lading", key: `bl-${s.id}`, title: `No bill of lading ${BILL_OF_LADING_DUE_DAYS}+ days after pickup`, detail, href: "/admin/shipments", since: s.shipping_status_updated_at ?? s.created_at, test: isTest });
    }
  }

  for (const i of inspectionRows) {
    const d = dealById.get(i.purchase_request_id);
    const isTest = d ? testUsers.has(d.buyer_id) : false;
    if (i.status === "submitted") {
      items.push({ kind: "inspection_review", key: `ir-${i.id}`, title: "Review an inspection report", detail: dealLabel(i.purchase_request_id), href: `/admin/inspections/${i.id}`, since: i.submitted_at ?? i.assigned_at, test: isTest });
    }
    if (i.pay_status === "owed") {
      items.push({
        kind: "inspector_pay",
        key: `ip-${i.id}`,
        title: `Pay the inspector${i.pay_usd != null ? ` $${Number(i.pay_usd).toFixed(2)}` : ""}`,
        detail: dealLabel(i.purchase_request_id),
        href: `/admin/inspections/${i.id}`,
        since: i.decided_at ?? i.assigned_at,
        test: isTest,
      });
    }
  }

  for (const v of listings.data ?? []) {
    items.push({ kind: "listing", key: `ls-${v.id}`, title: `Review listing: ${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`, detail: null, href: "/admin/listings", since: v.updated_at, test: testUsers.has(v.seller_id) });
  }
  for (const b of buyerIds.data ?? []) {
    const how = b.id_method === "document" ? "ID photo" : "name didn't match the ID record";
    items.push({ kind: "buyer_id", key: `bi-${b.user_id}`, title: "Check a buyer's ID", detail: `${b.id_country ?? ""} · ${how}`, href: "/admin/buyer-ids", since: b.created_at, test: testUsers.has(b.user_id) });
  }
  for (const s of shippers.data ?? []) {
    const isTest = s.is_test || testShippers.has(s.id);
    if (s.status === "pending") {
      items.push({ kind: "shipper", key: `sh-${s.id}`, title: "Review a shipper application", detail: s.company_name, href: "/admin/shippers", since: s.created_at, test: isTest });
    }
    if (s.coi_status === "pending") {
      items.push({ kind: "shipper_coi", key: `sc-${s.id}`, title: "Check a shipper's insurance certificate", detail: s.company_name, href: "/admin/shippers", since: s.coi_submitted_at ?? s.created_at, test: isTest });
    }
  }
  for (const a of inspectorApps.data ?? []) {
    items.push({ kind: "inspector_application", key: `in-${a.id}`, title: "Review an inspector application", detail: a.full_name, href: "/admin/inspectors", since: a.created_at, test: a.is_test });
  }
  for (const x of disputes.data ?? []) {
    items.push({
      kind: "dispute",
      key: `dp-${x.id}`,
      title: x.status === "approved_pending_refund" ? "Send an approved refund" : "Decide a dispute",
      detail: dealLabel(x.purchase_request_id),
      href: "/admin/disputes",
      since: x.created_at,
      test: testUsers.has(x.reporter_id),
    });
  }
  for (const d of deletions.data ?? []) {
    items.push({ kind: "account_deletion", key: `ad-${d.id}`, title: "Delete an account (requested)", detail: null, href: "/admin/account-deletions", since: d.requested_at, test: testUsers.has(d.user_id) });
  }
  for (const r of reviews.data ?? []) {
    items.push({ kind: "review", key: `rv-${r.id}`, title: r.status === "flagged" ? "Check a flagged review" : "Moderate a review", detail: null, href: "/admin/reviews", since: r.created_at, test: testUsers.has(r.reviewer_id) });
  }

  return { items, failed };
}
