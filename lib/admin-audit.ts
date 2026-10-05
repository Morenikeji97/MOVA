import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * ShipMova — the one way the app writes the admin audit log (migration
 * 0056). Call it with the admin's own session client (from requireAdmin),
 * after the action's write is confirmed. The database records who did it
 * from that session; the app can't name a different actor.
 *
 * Returns null on success, or the reason it failed (the action then says
 * "Saved, but the audit entry failed…" via savedWithAudit()).
 */
export async function logAdminAction(
  supabase: SupabaseClient<Database>,
  action: string,
  target: { table: string; id: string | null },
  details: Record<string, unknown> = {},
): Promise<string | null> {
  const { error } = await supabase.rpc("log_admin_action", {
    p_action: action,
    p_target_table: target.table,
    p_target_id: target.id,
    p_details: details,
  });
  if (error) {
    console.error(`admin audit log failed for ${action}:`, error);
    return error.message;
  }
  return null;
}
