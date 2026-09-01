import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

// Stripe SDK needs the Node runtime, and the raw request body must not be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SellerProfileUpdate =
  Database["public"]["Tables"]["seller_profiles"]["Update"];

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set.");
    return new NextResponse("Webhook not configured", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new NextResponse("Missing stripe-signature", { status: 400 });
  }

  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  // 'verified'       -> the session passed all checks.
  // 'requires_input' -> a check failed / the session can't complete as-is.
  if (
    event.type === "identity.verification_session.verified" ||
    event.type === "identity.verification_session.requires_input"
  ) {
    const session = event.data.object as Stripe.Identity.VerificationSession;
    const userId =
      typeof session.metadata?.user_id === "string"
        ? session.metadata.user_id
        : null;
    const verified = event.type === "identity.verification_session.verified";

    const update: SellerProfileUpdate = verified
      ? {
          id_verification_status: "verified",
          id_verified_at: new Date().toISOString(),
          id_verification_provider_ref: session.id,
        }
      : {
          id_verification_status: "failed",
          id_verified_at: null,
          id_verification_provider_ref: session.id,
        };

    // Service-role client: the webhook has no user session, and RLS on
    // seller_profiles would otherwise block this write.
    const admin = createAdminClient();
    const base = admin.from("seller_profiles").update(update);
    const { error } = userId
      ? await base.eq("user_id", userId)
      : await base.eq("id_verification_provider_ref", session.id);

    if (error) {
      console.error("seller_profiles update from webhook failed:", error);
      // 500 so Stripe retries.
      return new NextResponse("Database update failed", { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
