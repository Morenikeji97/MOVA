"use server";

import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";

/**
 * Precheck called from the signup form before the client's own
 * supabase.auth.signUp() call. Supabase Auth's own rate limiting on
 * /auth/v1/signup is a project-wide email-send quota, not per-IP (see
 * migration 0024's header comment) — this fills that specific gap: 5
 * attempts per IP per hour.
 *
 * Also hands back the resolved IP so the client can fold it into
 * signUp()'s raw_user_meta_data as `signup_ip` — handle_new_user() (0030)
 * stores it for the referral program's self-referral check
 * (lib/referrals.ts). Read here, server-side, for the same reason
 * policy/terms acceptance IPs always are: never trust a client-supplied IP.
 */
export async function checkSignupRateLimit(): Promise<{
  ok: boolean;
  error?: string;
  ip: string | null;
}> {
  const ip = await getRequestIp();
  const allowed = await checkRateLimit(`signup:${ip ?? "unknown"}`, 5, 60 * 60);
  return allowed ? { ok: true, ip } : { ok: false, error: RATE_LIMIT_MESSAGE, ip };
}
