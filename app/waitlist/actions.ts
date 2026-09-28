"use server";

import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";
import { validateWaitlist } from "@/lib/prelaunch";

export type JoinWaitlistResult = { ok: true } | { ok: false; error: string };

const SOURCES = ["site", "listing", "dashboard"] as const;
type Source = (typeof SOURCES)[number];

/**
 * "Join the waitlist" — the pre-launch replacement for Reserve and the fee
 * checkout. Anyone may sign up, signed in or not.
 *
 * Inserts with the caller's own session (anon or authenticated), so the
 * waitlist_signups RLS policy (insert-only; admin read) is what actually
 * applies — this action adds validation and a per-IP rate limit on top.
 */
export async function joinWaitlist(
  _prev: JoinWaitlistResult | null,
  formData: FormData,
): Promise<JoinWaitlistResult> {
  const v = validateWaitlist({
    email: String(formData.get("email") ?? ""),
    whatsapp: String(formData.get("whatsapp") ?? ""),
    country: String(formData.get("country") ?? ""),
  });
  if (!v.ok) return v;

  const rawSource = formData.get("source");
  const source: Source = SOURCES.includes(rawSource as Source) ? (rawSource as Source) : "site";
  const rawVehicle = formData.get("vehicleId");
  const vehicleId =
    typeof rawVehicle === "string" && /^[0-9a-f-]{36}$/i.test(rawVehicle) ? rawVehicle : null;

  const ip = await getRequestIp();
  const allowed = await checkRateLimit(`waitlist:${ip ?? "unknown"}`, 5, 60 * 60);
  if (!allowed) return { ok: false, error: RATE_LIMIT_MESSAGE };

  const supabase = await createClient();
  const { error } = await supabase.from("waitlist_signups").insert({
    email: v.email,
    whatsapp: v.whatsapp,
    country: v.country,
    vehicle_id: vehicleId,
    source,
  });
  if (error) {
    console.error("joinWaitlist: insert failed", error);
    return { ok: false, error: "We couldn't add you just now. Please try again." };
  }
  return { ok: true };
}
