import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { SHIPPER_SUSPEND_AFTER_UNPAID } from "@/lib/shipping";

type Client = SupabaseClient<Database>;

/**
 * Count a shipper's unpaid (charge-failed) commissions. Failures dated on or
 * before a manual reinstatement don't count — the admin cleared the slate.
 */
async function countUnpaidCommissions(
  client: Client,
  shipperId: string,
  reinstatedAt: string | null,
): Promise<number> {
  let query = client
    .from("shipment_requests")
    .select("id", { count: "exact", head: true })
    .eq("shipper_id", shipperId)
    .eq("commission_charge_status", "failed");
  if (reinstatedAt) query = query.gt("created_at", reinstatedAt);
  const { count } = await query;
  return count ?? 0;
}

/**
 * After a commission charge fails: move the shipper to `past_due`, or to
 * `suspended` once unpaid commissions exceed SHIPPER_SUSPEND_AFTER_UNPAID.
 * Never un-suspends.
 */
export async function applyStandingAfterFailure(
  client: Client,
  shipperId: string,
): Promise<void> {
  const { data: shipper } = await client
    .from("shippers")
    .select("payment_status, reinstated_at")
    .eq("id", shipperId)
    .maybeSingle();
  if (!shipper || shipper.payment_status === "suspended") return;

  const unpaid = await countUnpaidCommissions(
    client,
    shipperId,
    shipper.reinstated_at,
  );
  const next =
    unpaid > SHIPPER_SUSPEND_AFTER_UNPAID ? "suspended" : "past_due";

  await client
    .from("shippers")
    .update({ payment_status: next })
    .eq("id", shipperId)
    .neq("payment_status", "suspended");
}

/**
 * After a commission charge succeeds: lift `past_due` back to `good_standing`
 * once the shipper has nothing outstanding. A `suspended` shipper stays
 * suspended until an admin reinstates them.
 */
export async function maybeRestoreGoodStanding(
  client: Client,
  shipperId: string,
): Promise<void> {
  const { data: shipper } = await client
    .from("shippers")
    .select("payment_status, reinstated_at")
    .eq("id", shipperId)
    .maybeSingle();
  if (!shipper || shipper.payment_status !== "past_due") return;

  const unpaid = await countUnpaidCommissions(
    client,
    shipperId,
    shipper.reinstated_at,
  );
  if (unpaid === 0) {
    await client
      .from("shippers")
      .update({ payment_status: "good_standing" })
      .eq("id", shipperId)
      .eq("payment_status", "past_due");
  }
}
