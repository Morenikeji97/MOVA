import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * ShipMova — test accounts and test shipper applications (migration 0054).
 *
 * Production and every preview share one database, so the founder's test
 * logins and applications sit next to real ones. They're flagged
 * (users.is_test_account, shippers.is_test) and left out of admin counts.
 * Readable by admins only (RLS), which is who calls this.
 */
export async function loadTestIds(
  supabase: SupabaseClient<Database>,
): Promise<{ userIds: string[]; shipperIds: string[] }> {
  const [{ data: users }, { data: shippers }] = await Promise.all([
    supabase.from("users").select("id").eq("is_test_account", true),
    supabase.from("shippers").select("id").eq("is_test", true),
  ]);
  return {
    userIds: (users ?? []).map((u) => u.id),
    shipperIds: (shippers ?? []).map((s) => s.id),
  };
}

/** PostgREST `in` list: ["a","b"] -> "(a,b)". */
export function inList(ids: readonly string[]): string {
  return `(${ids.join(",")})`;
}

/** Leaves rows whose `column` is one of `ids` out of a query (no-op if none). */
export function excludeIds<Q extends { not(column: string, operator: string, value: unknown): Q }>(
  query: Q,
  column: string,
  ids: readonly string[],
): Q {
  return ids.length > 0 ? query.not(column, "in", inList(ids)) : query;
}
