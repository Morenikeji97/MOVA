import { headers } from "next/headers";

/**
 * App origin for building external return URLs (Stripe return_url / success_url).
 * Prefers NEXT_PUBLIC_APP_URL; falls back to the request host, which is fine
 * locally but should be set explicitly in deployed environments.
 */
export async function appUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
