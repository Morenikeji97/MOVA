"use server";

import { headers } from "next/headers";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";

/**
 * Precheck called from the login form before the client's own
 * supabase.auth.signInWithPassword() call. Supabase Auth's own rate limiting
 * on /auth/v1/token is IP-only (1800/hour, bursts to 30) — generous enough
 * that it doesn't catch focused brute-forcing of one account, and has no
 * email dimension at all (see migration 0024's header comment). This fills
 * that gap: 10 attempts per IP+email combo per 15 minutes.
 */
export async function checkLoginRateLimit(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const h = await headers();
  const ip =
    h.get("x-nf-client-connection-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  const key = `login:${ip}:${email.trim().toLowerCase()}`;
  const allowed = await checkRateLimit(key, 10, 15 * 60);
  return allowed ? { ok: true } : { ok: false, error: RATE_LIMIT_MESSAGE };
}
