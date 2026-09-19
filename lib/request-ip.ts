import { headers } from "next/headers";

/**
 * Best-effort client IP for the current request. Same header precedence
 * used independently by app/signup/actions.ts (rate limiting) and the
 * policy-acceptance actions before this was extracted — Netlify's own
 * header first (most reliable on this host), then the standard proxy
 * header, then nothing.
 */
export async function getRequestIp(): Promise<string | null> {
  const h = await headers();
  return (
    h.get("x-nf-client-connection-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null
  );
}
