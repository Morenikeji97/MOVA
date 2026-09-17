import { createAdminClient } from "@/lib/supabase/admin";

/** Shown to the user whenever any rate limit below is hit. */
export const RATE_LIMIT_MESSAGE =
  "You're doing that a bit fast — try again in a few minutes.";

/**
 * Checks and records one attempt against `bucketKey`, atomically, via the
 * `check_rate_limit` Postgres function (migration 0024). Returns false once
 * `maxCount` attempts have landed within the trailing `windowSeconds`.
 *
 * Server-side only — uses the service-role client, since `check_rate_limit`
 * is granted to `service_role` alone (a free-form bucket key granted to
 * end users would let one user grief another's bucket).
 *
 * Fails open: if the check itself errors (e.g. a transient DB issue), this
 * returns true rather than blocking the action. A rate-limiter outage
 * shouldn't be able to take down signups/logins/chat/reservations app-wide.
 */
export async function checkRateLimit(
  bucketKey: string,
  maxCount: number,
  windowSeconds: number,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("check_rate_limit", {
    p_bucket_key: bucketKey,
    p_max_count: maxCount,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("checkRateLimit failed:", error);
    return true;
  }
  return data === true;
}
