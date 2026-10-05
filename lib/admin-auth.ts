import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { requireAdminMfa } from "@/lib/admin-mfa";

/**
 * ShipMova — the one admin check for server actions and admin pages that
 * read with the service role. Replaces the seven copies that lived in each
 * app/admin/*\/actions.ts.
 *
 * Returns the caller's own (RLS-bound) client and id when they're an admin
 * with a code-checked session (aal2). An admin without the code is sent to
 * /mfa (requireAdminMfa redirects, so call this outside any try/catch).
 * Anyone else gets null; actions turn that into "Not saved: …".
 */
export async function requireAdmin(): Promise<{
  supabase: SupabaseClient<Database>;
  adminId: string;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return null;
  await requireAdminMfa(supabase);

  return { supabase, adminId: user.id };
}
