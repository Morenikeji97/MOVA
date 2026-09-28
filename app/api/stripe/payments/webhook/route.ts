import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyFeePaymentConfirmed } from "@/lib/notifications";
import { evaluateReferralQualification } from "@/lib/referral-credit";
import type { Database } from "@/types/database";

// Stripe SDK needs the Node runtime, and the raw request body must not be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PurchaseRequestUpdate =
  Database["public"]["Tables"]["purchase_requests"]["Update"];

/**
 * Buyer service-fee payments webhook. Separate endpoint from the Identity one
 * (/api/stripe/identity/webhook) — Stripe issues a distinct signing secret per
 * endpoint, so this reads STRIPE_PAYMENTS_WEBHOOK_SECRET.
 *
 * On `checkout.session.completed` for a paid session it marks the reservation's
 * fee paid. Paying the fee no longer reveals the seller's contact — the car
 * price goes through Escrow.com, never directly to the seller.
 */
export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_PAYMENTS_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_PAYMENTS_WEBHOOK_SECRET is not set.");
    return new NextResponse("Webhook not configured", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new NextResponse("Missing stripe-signature", { status: 400 });
  }

  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe payments webhook signature verification failed:", err);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const purchaseRequestId =
      typeof session.metadata?.purchase_request_id === "string"
        ? session.metadata.purchase_request_id
        : null;

    // Ignore sessions that completed without actually being paid (e.g. a
    // delayed/failed async payment method).
    if (purchaseRequestId && session.payment_status === "paid") {
      // Service-role client: the webhook has no user session.
      const admin = createAdminClient();

      const { data: pr } = await admin
        .from("purchase_requests")
        .select("id, vehicle_id, buyer_id, mova_fee_payment_status")
        .eq("id", purchaseRequestId)
        .maybeSingle();

      if (!pr) {
        console.error(
          "payments webhook: purchase_request not found:",
          purchaseRequestId,
        );
        return NextResponse.json({ received: true });
      }
      if (pr.mova_fee_payment_status === "paid") {
        // Already processed — Stripe retries are expected; treat as success.
        return NextResponse.json({ received: true });
      }

      const { data: vehicle } = await admin
        .from("vehicles")
        .select("seller_id")
        .eq("id", pr.vehicle_id)
        .maybeSingle();

      // Best-effort card fingerprint for the referral program's self-referral
      // check (lib/referrals.ts) — never blocks the actual fee confirmation
      // if Stripe can't be reached a second time or the session paid by some
      // non-card method with no fingerprint to report.
      let paymentMethodFingerprint: string | null = null;
      if (typeof session.payment_intent === "string") {
        try {
          const paymentIntent = await getStripe().paymentIntents.retrieve(
            session.payment_intent,
            { expand: ["payment_method"] },
          );
          const paymentMethod = paymentIntent.payment_method;
          paymentMethodFingerprint =
            typeof paymentMethod === "object" && paymentMethod?.card?.fingerprint
              ? paymentMethod.card.fingerprint
              : null;
        } catch (err) {
          console.error("payments webhook: fingerprint lookup failed:", err);
        }
      }

      const update: PurchaseRequestUpdate = {
        mova_fee_payment_status: "paid",
        mova_fee_payment_method_fingerprint: paymentMethodFingerprint,
      };

      const { error } = await admin
        .from("purchase_requests")
        .update(update)
        .eq("id", purchaseRequestId)
        .eq("mova_fee_payment_status", "pending");

      if (error) {
        console.error("purchase_requests fee-paid update failed:", error);
        // 500 so Stripe retries.
        return new NextResponse("Database update failed", { status: 500 });
      }

      await notifyFeePaymentConfirmed(purchaseRequestId);

      // Referral program: this fee landing on 'paid' can complete the
      // buyer's own qualifying referral, and/or the seller's (their vehicle
      // just had its first paid transaction) — see lib/referral-credit.ts.
      await evaluateReferralQualification(admin, {
        referredUserId: pr.buyer_id,
        purchaseRequestId,
      });
      if (vehicle) {
        await evaluateReferralQualification(admin, {
          referredUserId: vehicle.seller_id,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
