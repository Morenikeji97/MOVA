"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminMfa } from "@/lib/admin-mfa";
import { describeRateChanges, parseRatesForm } from "@/lib/landed-cost";

export type SaveRatesResult = { ok: true; note: string } | { ok: false; error: string };

/**
 * Save the Nigerian import rates and mark them checked today.
 *
 * Runs with the admin's own session, so the "import rates admin update" RLS
 * policy (is_admin(), which requires a two-step sign-in) is what allows the
 * write; the role and MFA checks here are belt-and-braces. Every save,
 * including "checked, nothing changed", is written to admin_actions_log
 * with the before -> after values.
 */
export async function saveImportRates(
  _prev: SaveRatesResult | null,
  formData: FormData,
): Promise<SaveRatesResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") return { ok: false, error: "Admins only." };
  await requireAdminMfa(supabase);

  const parsed = parseRatesForm((name) => formData.get(name));
  if (!parsed.ok) return parsed;

  const sourceRaw = formData.get("source_note");
  const sourceNote = typeof sourceRaw === "string" ? sourceRaw.trim().slice(0, 1000) : "";
  if (sourceNote.length === 0) {
    return { ok: false, error: "Say where these rates came from (e.g. the agent's name and date)." };
  }

  const { data: before, error: readError } = await supabase
    .from("import_rates")
    .select("*")
    .eq("country", "NG")
    .maybeSingle();
  if (readError || !before) {
    return { ok: false, error: "Couldn't load the current rates. Please try again." };
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("import_rates")
    .update({
      ...parsed.row,
      source_note: sourceNote,
      last_verified_at: now,
      updated_by: user.id,
      updated_at: now,
    })
    .eq("country", "NG")
    .select("country");
  if (updateError || !updated || updated.length === 0) {
    return { ok: false, error: "The rates weren't saved. Please try again." };
  }

  const changes = describeRateChanges(before, parsed.row);
  const { error: logError } = await supabase.from("admin_actions_log").insert({
    admin_id: user.id,
    action_type: "import_rates_updated",
    target_table: "import_rates",
    target_id: null,
    notes: `NG: ${changes}. Source: ${sourceNote}`.slice(0, 2000),
  });
  if (logError) {
    // The rates are saved; the missing audit row is the thing to surface.
    return {
      ok: false,
      error: "Rates saved, but the audit log entry failed. Tell the founder.",
    };
  }

  revalidatePath("/admin/import-rates");
  revalidatePath("/browse/[id]", "page");
  return { ok: true, note: changes };
}
