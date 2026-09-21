import { getStripe } from "@/lib/stripe";

/**
 * Best-effort lookup of the legal name Stripe Identity extracted from a
 * verified session's ID document. verified_outputs isn't guaranteed to be
 * present on a webhook payload itself (Stripe's data minimization for
 * identity data), so this always does an explicit expand — used both at
 * webhook time (app/api/stripe/identity/webhook) and for the one-time
 * backfill of sellers who were already 'verified' before that webhook
 * started capturing this (app/admin/listings/page.tsx) — same lookup,
 * same caveats, one place to fix if Stripe's shape ever changes.
 *
 * Returns null on any failure (unknown session id, no verified_outputs,
 * network error) rather than throwing — callers treat "couldn't get a
 * name" as a normal, expected outcome, not an error condition.
 */
export async function fetchVerifiedSellerName(sessionId: string): Promise<string | null> {
  try {
    const session = await getStripe().identity.verificationSessions.retrieve(sessionId, {
      expand: ["verified_outputs"],
    });
    const outputs = session.verified_outputs;
    const name = [outputs?.first_name, outputs?.last_name].filter(Boolean).join(" ").trim();
    return name.length > 0 ? name : null;
  } catch (err) {
    console.error("fetchVerifiedSellerName failed:", err);
    return null;
  }
}
