import Stripe from "stripe";

// Pinned to the version bundled with the installed `stripe` package.
const API_VERSION = "2026-08-26.dahlia";

let client: Stripe | null = null;

/**
 * Lazily-constructed Stripe client. Kept lazy so that importing this module
 * (e.g. during `next build`) doesn't throw when STRIPE_SECRET_KEY is unset —
 * it only fails at the point of an actual API call.
 */
export function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set.");
    }
    client = new Stripe(key, { apiVersion: API_VERSION });
  }
  return client;
}
