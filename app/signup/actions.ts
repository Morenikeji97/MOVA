"use server";

import { headers } from "next/headers";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";

/**
 * Precheck called from the signup form before the client's own
 * supabase.auth.signUp() call. Supabase Auth's own rate limiting on
 * /auth/v1/signup is a project-wide email-send quota, not per-IP (see
 * migration 0024's header comment) — this fills that specific gap: 5
 * attempts per IP per hour.
 */
export async function checkSignupRateLimit(): Promise<{ ok: boolean; error?: string }> {
  const h = await headers();
  const ip =
    h.get("x-nf-client-connection-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  const allowed = await checkRateLimit(`signup:${ip}`, 5, 60 * 60);
  return allowed ? { ok: true } : { ok: false, error: RATE_LIMIT_MESSAGE };
}
