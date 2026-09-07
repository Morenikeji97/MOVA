"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { appUrl } from "@/lib/app-url";
import { isServiceCountry } from "@/lib/shipping";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Escape LIKE metacharacters so an email is matched literally, case-insensitively. */
function likeLiteral(s: string): string {
  return s.replace(/([\\%_])/g, "\\$1");
}

/**
 * Resolve the signed-in user's own approved shipper. Rate mutations run as the
 * shipper's session and are additionally gated by the "shipping rates shipper
 * write" RLS policy (shippers.user_id = auth.uid() AND status = 'approved').
 */
async function requireApprovedShipper() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: shipper } = await supabase
    .from("shippers")
    .select("id, status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!shipper || shipper.status !== "approved") return null;

  return { supabase, shipperId: shipper.id };
}

function revalidateRateViews() {
  revalidatePath("/shipper");
  revalidatePath("/admin/shippers");
  revalidatePath("/browse", "layout");
}

/**
 * Link the signed-in account to an approved shipper record whose contact email
 * matches the account's (verified) email. Used when a shipper applied while
 * logged out and only created a MOVA login afterwards.
 *
 * The link write needs the service role — RLS only lets admins update shippers
 * — but the action is safe: the target is pinned by the caller's
 * Supabase-verified email, must be `approved`, and must be unclaimed.
 */
export async function claimShipper(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login?next=/shipper");

  const email = user.email.toLowerCase();
  const admin = createAdminClient();
  const { data: shipper } = await admin
    .from("shippers")
    .select("id, contact_email, status, user_id")
    .ilike("contact_email", likeLiteral(user.email))
    .maybeSingle();

  if (
    !shipper ||
    shipper.status !== "approved" ||
    shipper.user_id !== null ||
    shipper.contact_email.toLowerCase() !== email
  ) {
    redirect("/shipper?claim=failed");
  }

  const { error } = await admin
    .from("shippers")
    .update({ user_id: user.id })
    .eq("id", shipper.id)
    .is("user_id", null);
  if (error) {
    console.error("claimShipper link failed:", error);
    redirect("/shipper?claim=failed");
  }

  revalidatePath("/shipper");
  redirect("/shipper?claim=ok");
}

interface RateFields {
  origin_region: string;
  origin_port: string | null;
  destination_country: string;
  vehicle_size_type: string | null;
  price: number;
  currency: string;
}

/** Parse + validate the shared rate form fields; null if anything is invalid. */
function readRateFields(formData: FormData): RateFields | null {
  const originRegion = str(formData.get("origin_region"));
  const destinationCountry = str(formData.get("destination_country"));
  const price = Number(str(formData.get("price")));
  const currency = str(formData.get("currency")).toUpperCase() || "USD";

  if (!originRegion || !destinationCountry) return null;
  if (!isServiceCountry(destinationCountry)) return null;
  if (!Number.isFinite(price) || price < 0) return null;

  return {
    origin_region: originRegion,
    origin_port: str(formData.get("origin_port")) || null,
    destination_country: destinationCountry,
    vehicle_size_type: str(formData.get("vehicle_size_type")) || null,
    price,
    currency,
  };
}

/** Add a rate for the signed-in shipper. */
export async function addShipperRate(formData: FormData): Promise<void> {
  const ctx = await requireApprovedShipper();
  if (!ctx) return;

  const fields = readRateFields(formData);
  if (!fields) return;

  await ctx.supabase
    .from("shipping_rates")
    .insert({ shipper_id: ctx.shipperId, ...fields });

  revalidateRateViews();
}

/** Edit one of the signed-in shipper's rates. */
export async function updateShipperRate(formData: FormData): Promise<void> {
  const ctx = await requireApprovedShipper();
  if (!ctx) return;

  const id = str(formData.get("id"));
  if (!id) return;
  const fields = readRateFields(formData);
  if (!fields) return;

  // RLS confines this to the shipper's own rows; the shipper_id filter is
  // belt-and-braces.
  await ctx.supabase
    .from("shipping_rates")
    .update(fields)
    .eq("id", id)
    .eq("shipper_id", ctx.shipperId);

  revalidateRateViews();
}

/** Show/hide one of the signed-in shipper's rates from buyers. */
export async function setShipperRateActive(formData: FormData): Promise<void> {
  const ctx = await requireApprovedShipper();
  if (!ctx) return;

  const id = str(formData.get("id"));
  if (!id) return;
  const active = str(formData.get("active")) === "true";

  await ctx.supabase
    .from("shipping_rates")
    .update({ active })
    .eq("id", id)
    .eq("shipper_id", ctx.shipperId);

  revalidateRateViews();
}

/** Permanently remove one of the signed-in shipper's rates. */
export async function deleteShipperRate(formData: FormData): Promise<void> {
  const ctx = await requireApprovedShipper();
  if (!ctx) return;

  const id = str(formData.get("id"));
  if (!id) return;

  await ctx.supabase
    .from("shipping_rates")
    .delete()
    .eq("id", id)
    .eq("shipper_id", ctx.shipperId);

  revalidateRateViews();
}

/**
 * Send the shipper to Stripe (Checkout in `setup` mode) to replace the card
 * MOVA charges commission to. The shipper-commission webhook writes the new
 * Customer / PaymentMethod tokens back on `checkout.session.completed`.
 */
export async function startShipperCardSetup(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/shipper");

  const admin = createAdminClient();
  const { data: shipper } = await admin
    .from("shippers")
    .select("id, company_name, contact_email, status, stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!shipper || shipper.status !== "approved") redirect("/shipper");

  let redirectUrl: string | null = null;
  try {
    const stripe = getStripe();
    const customerId =
      shipper.stripe_customer_id ??
      (
        await stripe.customers.create({
          name: shipper.company_name,
          email: shipper.contact_email,
          metadata: { shipper_id: shipper.id },
        })
      ).id;

    const origin = await appUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      customer: customerId,
      payment_method_types: ["card"],
      metadata: { shipper_id: shipper.id },
      setup_intent_data: { metadata: { shipper_id: shipper.id } },
      success_url: `${origin}/shipper?card=updated`,
      cancel_url: `${origin}/shipper?card=cancelled`,
    });
    redirectUrl = session.url ?? null;
  } catch (err) {
    console.error("startShipperCardSetup failed:", err);
    redirect("/shipper?card=error");
  }

  if (!redirectUrl) redirect("/shipper?card=error");
  redirect(redirectUrl);
}
