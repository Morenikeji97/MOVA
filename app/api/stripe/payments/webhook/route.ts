import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
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
 * fee paid and snapshots the seller's contact + name onto the row so the buyer
 * (whom RLS blocks from the seller's own rows) can see who to wire and how.
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
      // Service-role client: the webhook has no user session, and it needs to
      // read the seller's users / seller_profiles rows that RLS would hide.
      const admin = createAdminClient();

      const { data: pr } = await admin
        .from("purchase_requests")
        .select("id, vehicle_id, mova_fee_payment_status")
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

      let sellerName: string | null = null;
      let sellerEmail: string | null = null;
      let sellerPhone: string | null = null;
      let sellerWhatsapp: string | null = null;

      if (vehicle) {
        const [{ data: sellerUser }, { data: sellerProfile }] = await Promise.all([
          admin
            .from("users")
            .select("email, phone, whatsapp_number")
            .eq("id", vehicle.seller_id)
            .maybeSingle(),
          admin
            .from("seller_profiles")
            .select("full_name")
            .eq("user_id", vehicle.seller_id)
            .maybeSingle(),
        ]);
        sellerEmail = sellerUser?.email ?? null;
        sellerPhone = sellerUser?.phone ?? null;
        sellerWhatsapp = sellerUser?.whatsapp_number ?? null;
        sellerName = sellerProfile?.full_name ?? null;
      }

      const update: PurchaseRequestUpdate = {
        mova_fee_payment_status: "paid",
        seller_details_revealed_at: new Date().toISOString(),
        seller_name: sellerName,
        seller_email: sellerEmail,
        seller_phone: sellerPhone,
        seller_whatsapp: sellerWhatsapp,
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
    }
  }

  return NextResponse.json({ received: true });
}
