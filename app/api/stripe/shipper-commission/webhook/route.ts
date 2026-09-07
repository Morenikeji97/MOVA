import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  applyStandingAfterFailure,
  maybeRestoreGoodStanding,
} from "@/lib/shipper-billing";

// Stripe SDK needs the Node runtime, and the raw request body must not be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Shipper commission webhook. Deliberately separate from the buyer payments
 * webhook (/api/stripe/payments/webhook) and every other Stripe endpoint —
 * Stripe issues a distinct signing secret per endpoint, so this one reads
 * STRIPE_SHIPPER_COMMISSION_WEBHOOK_SECRET and touches only shipper tables.
 *
 * Handles:
 *  - checkout.session.completed (mode=setup): the shipper finished adding a
 *    card at signup — save the Customer + PaymentMethod tokens and make the PM
 *    the customer default for future off-session charges.
 *  - payment_intent.succeeded / .payment_failed: the off-session commission
 *    charge kicked off when an admin marks a shipment completed — record the
 *    outcome and adjust the shipper's payment standing.
 *
 * All writes go through the service role: the webhook has no user session, and
 * the stripe_* columns aren't readable by anon/authenticated.
 */
export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_SHIPPER_COMMISSION_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_SHIPPER_COMMISSION_WEBHOOK_SECRET is not set.");
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
      webhookSecret,
    );
  } catch (err) {
    console.error(
      "Stripe shipper-commission webhook signature verification failed:",
      err,
    );
    return new NextResponse("Invalid signature", { status: 400 });
  }

  const admin = createAdminClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "setup") {
      return NextResponse.json({ received: true });
    }

    const shipperId =
      typeof session.metadata?.shipper_id === "string"
        ? session.metadata.shipper_id
        : null;
    const customerId =
      typeof session.customer === "string" ? session.customer : null;
    const setupIntentId =
      typeof session.setup_intent === "string" ? session.setup_intent : null;
    if (!shipperId || !customerId || !setupIntentId) {
      console.error("shipper setup session missing ids:", session.id);
      return NextResponse.json({ received: true });
    }

    const setupIntent =
      await getStripe().setupIntents.retrieve(setupIntentId);
    const paymentMethodId =
      typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : null;
    if (!paymentMethodId) {
      console.error("shipper setup intent has no payment method:", setupIntentId);
      return NextResponse.json({ received: true });
    }

    // Make it the customer's default so off-session PaymentIntents pick it up.
    try {
      await getStripe().customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
    } catch (err) {
      console.error("shipper customer default PM update failed:", err);
    }

    const { error } = await admin
      .from("shippers")
      .update({
        stripe_customer_id: customerId,
        stripe_payment_method_id: paymentMethodId,
        card_on_file: true,
      })
      .eq("id", shipperId);

    if (error) {
      console.error("shippers stripe token update failed:", error);
      return new NextResponse("Database update failed", { status: 500 });
    }
    return NextResponse.json({ received: true });
  }

  if (
    event.type === "payment_intent.succeeded" ||
    event.type === "payment_intent.payment_failed"
  ) {
    const pi = event.data.object as Stripe.PaymentIntent;
    const shipmentRequestId =
      typeof pi.metadata?.shipment_request_id === "string"
        ? pi.metadata.shipment_request_id
        : null;
    const shipperId =
      typeof pi.metadata?.shipper_id === "string"
        ? pi.metadata.shipper_id
        : null;

    // Not one of ours (no shipment metadata) — ignore quietly.
    if (!shipmentRequestId || !shipperId) {
      return NextResponse.json({ received: true });
    }

    const succeeded = event.type === "payment_intent.succeeded";

    const { error } = await admin
      .from("shipment_requests")
      .update({
        commission_charge_status: succeeded ? "charged" : "failed",
        stripe_charge_id: pi.id,
      })
      .eq("id", shipmentRequestId)
      // Stripe retries are expected; don't walk back a charged row.
      .neq("commission_charge_status", "charged");

    if (error) {
      console.error("shipment_requests commission update failed:", error);
      return new NextResponse("Database update failed", { status: 500 });
    }

    if (succeeded) {
      await maybeRestoreGoodStanding(admin, shipperId);
    } else {
      await applyStandingAfterFailure(admin, shipperId);
    }
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}
