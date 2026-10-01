"use server";

import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";
import {
  validatePartnerWaitlist,
  validateWaitlist,
  WAITLIST_SOURCES,
  type WaitlistAudience,
  type WaitlistSource,
} from "@/lib/prelaunch";

export type JoinWaitlistResult = { ok: true } | { ok: false; error: string };

const GENERIC_ERROR =
  "We couldn't add you just now. Please try again, or message us on WhatsApp.";

/**
 * "Join the waitlist" — the pre-launch replacement for Reserve and the fee
 * checkout, and the "get notified" form for sellers on /sell. Anyone may
 * sign up, signed in or not.
 *
 * Inserts with the caller's own session (anon or authenticated), so the
 * waitlist_signups grants + RLS policy (insert-only; admin read) are what
 * actually apply — this action adds validation and a per-IP rate limit.
 *
 * Never throws: every failure comes back as { ok: false, error } so the
 * form always shows a message instead of an error page.
 */
export async function joinWaitlist(
  _prev: JoinWaitlistResult | null,
  formData: FormData,
): Promise<JoinWaitlistResult> {
  try {
    const v = validateWaitlist({
      email: String(formData.get("email") ?? ""),
      whatsapp: String(formData.get("whatsapp") ?? ""),
      country: String(formData.get("country") ?? ""),
    });
    if (!v.ok) return v;

    const rawSource = formData.get("source");
    const source: WaitlistSource = WAITLIST_SOURCES.includes(rawSource as WaitlistSource)
      ? (rawSource as WaitlistSource)
      : "site";
    // The buyer/seller form only; partners go through joinPartnerWaitlist.
    const audience: WaitlistAudience = formData.get("audience") === "seller" ? "seller" : "buyer";
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
      audience,
    });
    if (error) {
      console.error("joinWaitlist: insert failed", error);
      return { ok: false, error: GENERIC_ERROR };
    }
    return { ok: true };
  } catch (err) {
    console.error("joinWaitlist: unexpected failure", err);
    return { ok: false, error: GENERIC_ERROR };
  }
}

/**
 * "Register your interest" for partners: /inspectors (audience inspector)
 * and /clearing-agents (audience clearing_agent). Same table and same
 * insert-only grants as joinWaitlist; lib/prelaunch.ts validatePartnerWaitlist
 * decides which fields each audience needs. Never throws.
 */
export async function joinPartnerWaitlist(
  _prev: JoinWaitlistResult | null,
  formData: FormData,
): Promise<JoinWaitlistResult> {
  try {
    const audience = formData.get("audience");
    if (audience !== "inspector" && audience !== "clearing_agent") {
      return { ok: false, error: GENERIC_ERROR };
    }
    const str = (k: string) => String(formData.get(k) ?? "");
    const v = validatePartnerWaitlist({
      audience,
      fullName: str("full_name"),
      email: str("email"),
      whatsapp: str("whatsapp"),
      company: str("company"),
      cityState: str("city_state"),
      experience: str("experience"),
      ports: formData.getAll("ports").map(String),
      licenseNumber: str("license_number"),
    });
    if (!v.ok) return v;

    const ip = await getRequestIp();
    const allowed = await checkRateLimit(`waitlist:${ip ?? "unknown"}`, 5, 60 * 60);
    if (!allowed) return { ok: false, error: RATE_LIMIT_MESSAGE };

    const supabase = await createClient();
    const { error } = await supabase.from("waitlist_signups").insert({
      ...v.row,
      source: audience === "inspector" ? "inspectors" : "clearing_agents",
    });
    if (error) {
      console.error("joinPartnerWaitlist: insert failed", error);
      return { ok: false, error: GENERIC_ERROR };
    }
    return { ok: true };
  } catch (err) {
    console.error("joinPartnerWaitlist: unexpected failure", err);
    return { ok: false, error: GENERIC_ERROR };
  }
}
