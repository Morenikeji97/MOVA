import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MFA_PATH } from "@/lib/admin-mfa-paths";

/**
 * ShipMova — two-step (TOTP) sign-in for admin accounts.
 *
 * An admin's session counts as admin only at Supabase Auth assurance level
 * aal2: password, then a code from an authenticator app. Enforced in three
 * places, all reading the same `aal` JWT claim:
 *   - middleware.ts sends an admin without it to MFA_PATH on every page;
 *   - public.is_admin() requires it, so RLS does too (migration 0048);
 *   - requireAdminMfa() below, called by every admin server action and by
 *     admin pages that read with the service-role key (which bypasses RLS).
 *     Server actions are callable by id from any page, so the middleware's
 *     redirect alone can't cover them.
 *
 * Lost phone: docs/admin-mfa-recovery.md.
 */

/** True when this session's verified JWT is at aal2. */
export async function hasMfaSession(supabase: Pick<SupabaseClient, "auth">): Promise<boolean> {
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return false;
  return data.claims.aal === "aal2";
}

/**
 * For code already past its admin role check: sends a session without a
 * code to MFA_PATH (redirect() throws, so nothing after this runs). Call it
 * outside any try/catch.
 */
export async function requireAdminMfa(supabase: Pick<SupabaseClient, "auth">): Promise<void> {
  if (!(await hasMfaSession(supabase))) redirect(MFA_PATH);
}
