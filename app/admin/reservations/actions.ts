"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { appUrl } from "@/lib/app-url";
import { feeBreakdown } from "@/lib/fees";

/**
 * Admin actions for the reservation queue (purchase_requests). Bound to
 * <form action={…}> with a hidden `id` field.
 *
 * middleware.ts gates /admin to role 'admin'; requireAdmin() re-checks here;
 * and the "purchase requests admin update" RLS policy (public.is_admin())
 * enforces it at the database.
 */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return null;

  return supabase;
}

/** Move a fresh request into review. */
export async function markReservationUnderReview(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) return;

  const supabase = await requireAdmin();
  if (!supabase) return;

  await supabase
    .from("purchase_requests")
    .update({ status: "under_review" })
    .eq("id", id)
    .eq("status", "submitted");

  revalidatePath("/admin/reservations");
}

/** Release a reservation — the buyer no longer holds intent on the vehicle. */
export async function releaseReservation(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) return;

  const supabase = await requireAdmin();
  if (!supabase) return;

  // Only release requests that are still open; a status filter keeps a
  // double-submit from clobbering a later state.
  await supabase
    .from("purchase_requests")
    .update({ status: "cancelled" })
    .eq("id", id)
    .in("status", ["submitted", "under_review", "verified"]);

  revalidatePath("/admin/reservations");
}

/**
 * Generate (or regenerate) the buyer's Stripe Checkout link for their share of
 * MOVA's service fee. Available once a reservation is past 'submitted'
 * (under_review / verified) and the fee hasn't been paid yet.
 *
 * The buyer pays only their portion — the full fee when the seller chose
 * "buyer pays full", half of it when the seller chose to split. On successful
 * payment the /api/stripe/payments/webhook endpoint flips
 * mova_fee_payment_status to 'paid' and reveals the seller's details.
 *
 * The link is stored on the reservation and surfaced on the buyer's dashboard.
 */
export async function requestFeePayment(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) return;

  const supabase = await requireAdmin();
  if (!supabase) return;

  const { data: pr } = await supabase
    .from("purchase_requests")
    .select(
      "id, vehicle_id, buyer_id, status, mova_fee_payment_status, vehicle_price_usd, mova_fee_usd",
    )
    .eq("id", id)
    .maybeSingle();
  if (!pr) return;
  if (pr.mova_fee_payment_status === "paid") return;
  if (pr.status !== "under_review" && pr.status !== "verified") return;

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("year, make, model, trim, price_usd, fee_responsibility")
    .eq("id", pr.vehicle_id)
    .maybeSingle();
  if (!vehicle) return;

  const { data: buyer } = await supabase
    .from("users")
    .select("email")
    .eq("id", pr.buyer_id)
    .maybeSingle();

  // Price the fee from the reservation-time snapshot when we have one, else
  // from the live listing (older reservations predate the snapshot columns).
  const price =
    pr.vehicle_price_usd != null
      ? Number(pr.vehicle_price_usd)
      : Number(vehicle.price_usd);
  const { fullFee, buyerFee } = feeBreakdown(price, vehicle.fee_responsibility);

  const amountCents = Math.round(buyerFee * 100);
  if (amountCents < 50) return; // Stripe's minimum charge.

  const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}${
    vehicle.trim ? ` ${vehicle.trim}` : ""
  }`;
  const origin = await appUrl();

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: `MOVA service fee — ${title}`,
            description:
              vehicle.fee_responsibility === "split"
                ? "Your half of MOVA's 8% service fee (the seller covers the other half)."
                : "MOVA's 8% service fee.",
          },
        },
      },
    ],
    customer_email: buyer?.email ?? undefined,
    metadata: { purchase_request_id: pr.id },
    success_url: `${origin}/buyer/dashboard?fee=paid`,
    cancel_url: `${origin}/buyer/dashboard?fee=cancelled`,
  });

  await supabase
    .from("purchase_requests")
    .update({
      vehicle_price_usd: price,
      mova_fee_usd: fullFee,
      mova_fee_stripe_session_id: session.id,
      mova_fee_checkout_url: session.url,
    })
    .eq("id", pr.id)
    .eq("mova_fee_payment_status", "pending");

  revalidatePath("/admin/reservations");
  revalidatePath("/buyer/dashboard");
}
