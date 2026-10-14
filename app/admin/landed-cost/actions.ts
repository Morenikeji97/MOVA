"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { SESSION_ENDED, checkWrite, notSaved, savedWithAudit, type ActionResult } from "@/lib/action-result";
import { IMPORT_COUNTRY_NAME } from "@/lib/import-rules";
import { isLandedCountry, parseLandedForm } from "@/lib/landed-cost";

/**
 * Saves one country's landed-cost rates and marks them checked today.
 * Admin with the authenticator code only (requireAdmin + the table's
 * is_admin() update rule); every save is audit-logged with before/after.
 */
export async function updateLandedCostRates(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);

  const country = formData.get("country");
  if (!isLandedCountry(country)) return notSaved("unknown country.");
  const parsed = parseLandedForm((n) => formData.get(n));
  if (!parsed.ok) return notSaved(parsed.error);

  const { data: before } = await ctx.supabase
    .from("landed_cost_rates")
    .select("duties_min_pct, duties_max_pct, insurance_pct, fixed_fees_usd, port_clearing_min_usd, port_clearing_max_usd, source_note, source_url")
    .eq("country", country)
    .maybeSingle();

  const today = new Date().toISOString().slice(0, 10);
  const result = await ctx.supabase
    .from("landed_cost_rates")
    .update({ ...parsed.row, last_checked_on: today, updated_by: ctx.adminId, updated_at: new Date().toISOString() })
    .eq("country", country)
    .select("country");
  const failed = checkWrite(result);
  if (failed) return failed;

  const auditError = await logAdminAction(
    ctx.supabase,
    "landed_cost.update",
    { table: "landed_cost_rates", id: country },
    { before, after: parsed.row, last_checked_on: today },
  );
  revalidatePath("/admin/landed-cost");
  return savedWithAudit(`Saved ${IMPORT_COUNTRY_NAME[country]} — marked checked today.`, auditError);
}
