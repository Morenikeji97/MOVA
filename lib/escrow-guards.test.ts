import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Migration 0062: escrow fields can only be written by ShipMova's server or
// an admin, and the shipping price always comes from the shipper's rate.
const sql = readFileSync("supabase/migrations/0062_escrow_integration.sql", "utf8");
const webhook = readFileSync("app/api/escrow/webhook/route.ts", "utf8");

function fn(name: string): string {
  const start = sql.indexOf(`function public.${name}()`);
  assert.ok(start > 0, `${name} missing`);
  return sql.slice(start, sql.indexOf("$$;", start));
}

test("shipments: the browser's price is replaced by the rate's, and escrow fields are pinned", () => {
  const g = fn("shipment_requests_guard_escrow");
  assert.match(g, /if public\.is_admin\(\) or auth\.role\(\) = 'service_role' then\s+return new;/);
  assert.match(g, /new\.agreed_rate := r\.price;/);
  assert.match(g, /new\.inland_usd := r\.inland_price;/);
  for (const c of ["escrow_transaction_id", "escrow_inland_state", "escrow_ocean_state", "escrow_fee_usd", "escrow_synced_at"]) {
    assert.match(g, new RegExp(`new\\.${c} := null;`), `insert must clear ${c}`);
    assert.match(g, new RegExp(`new\\.${c} := old\\.${c};`), `update must pin ${c}`);
  }
  assert.match(sql, /before insert or update on public\.shipment_requests/);
});

test("reservations: buyers and sellers can't set any escrow field", () => {
  const g = fn("purchase_requests_guard_escrow");
  for (const c of ["escrow_reference", "escrow_stage", "escrow_car_state", "escrow_fee_usd", "escrow_synced_at"]) {
    assert.match(g, new RegExp(`new\\.${c} := null;`), `insert must clear ${c}`);
    assert.match(g, new RegExp(`new\\.${c} := old\\.${c};`), `update must pin ${c}`);
  }
  assert.match(sql, /before insert or update on public\.purchase_requests/);
});

test("webhook log: admin read only; webhook needs the key and re-fetches", () => {
  assert.match(sql, /alter table public\.escrow_webhook_events enable row level security/);
  assert.match(sql, /"escrow webhook events admin read"[\s\S]*?using \(public\.is_admin\(\)\)/);
  assert.doesNotMatch(sql, /policy[^;]*escrow_webhook_events[^;]*for (insert|update|delete|all)/i);
  assert.match(webhook, /timingSafeEqual/);
  assert.match(webhook, /syncEscrowTransaction\(transactionId/);
});

test("the public rates view keeps its rule and only appends inland_price", () => {
  assert.match(sql, /view public\.shipper_rates_public with \(security_invoker = true\)[\s\S]*?s\.coi_expires_on,\s+r\.inland_price\s+from/);
  assert.match(sql, /where r\.active and public\.shipper_is_bookable\(s\.id\);/);
});
