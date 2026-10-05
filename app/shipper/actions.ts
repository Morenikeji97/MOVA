"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { appUrl } from "@/lib/app-url";
import { isServiceCountry, isVehicleSizeType, isShippingMethod } from "@/lib/shipping";
import type { ShippingMethod, VehicleSizeType } from "@/types/database";
import { checkWrite, notSaved, saved, type ActionResult } from "@/lib/action-result";

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
  revalidatePath("/shipper/portal");
  revalidatePath("/admin/shippers");
  revalidatePath("/browse", "layout");
}

/**
 * Link the signed-in account to an approved shipper record whose contact email
 * matches the account's (verified) email. Used when a shipper applied while
 * logged out and only created a ShipMova login afterwards.
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
  if (!user?.email) redirect("/login?next=/shipper/portal");

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
    redirect("/shipper/portal?claim=failed");
  }

  const { data: linked, error } = await admin
    .from("shippers")
    .update({ user_id: user.id })
    .eq("id", shipper.id)
    .is("user_id", null)
    .select("id");
  if (error || !linked || linked.length === 0) {
    console.error("claimShipper link failed:", error ?? "no row linked");
    redirect("/shipper/portal?claim=failed");
  }

  revalidatePath("/shipper/portal");
  redirect("/shipper/portal?claim=ok");
}

interface RateFields {
  origin_region: string;
  origin_port: string | null;
  destination_country: string;
  vehicle_size_type: VehicleSizeType;
  shipping_method: ShippingMethod;
  price: number;
  currency: string;
}

/** Parse + validate the shared rate form fields; the reason if anything is invalid. */
function readRateFields(formData: FormData): RateFields | string {
  const originRegion = str(formData.get("origin_region"));
  const destinationCountry = str(formData.get("destination_country"));
  const vehicleSizeType = str(formData.get("vehicle_size_type"));
  const shippingMethod = str(formData.get("shipping_method"));
  const price = Number(str(formData.get("price")));
  const currency = str(formData.get("currency")).toUpperCase() || "USD";

  if (!originRegion) return "add the pickup region.";
  if (!isServiceCountry(destinationCountry)) return "choose a destination country.";
  if (!isVehicleSizeType(vehicleSizeType)) return "choose a vehicle size.";
  if (!isShippingMethod(shippingMethod)) return "choose a shipping method.";
  if (!Number.isFinite(price) || price < 0) return "the price must be a number, 0 or more.";

  return {
    origin_region: originRegion,
    origin_port: str(formData.get("origin_port")) || null,
    destination_country: destinationCountry,
    vehicle_size_type: vehicleSizeType,
    shipping_method: shippingMethod,
    price,
    currency,
  };
}

/** Add a rate for the signed-in shipper. */
const NOT_APPROVED = "your shipper account isn't approved and linked yet, or your session ended. Sign in again.";

export async function addShipperRate(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireApprovedShipper();
  if (!ctx) return notSaved(NOT_APPROVED);

  const fields = readRateFields(formData);
  if (typeof fields === "string") return notSaved(fields);

  const res = await ctx.supabase
    .from("shipping_rates")
    .insert({ shipper_id: ctx.shipperId, ...fields })
    .select("id");
  const bad = checkWrite(res);
  if (bad) return bad;

  revalidateRateViews();
  return saved("Rate added — buyers can see it.");
}

/** Edit one of the signed-in shipper's rates. */
export async function updateShipperRate(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireApprovedShipper();
  if (!ctx) return notSaved(NOT_APPROVED);

  const id = str(formData.get("id"));
  if (!id) return notSaved("the form is missing the rate. Reload and try again.");
  const fields = readRateFields(formData);
  if (typeof fields === "string") return notSaved(fields);

  // RLS confines this to the shipper's own rows; the shipper_id filter is
  // belt-and-braces.
  const res = await ctx.supabase
    .from("shipping_rates")
    .update(fields)
    .eq("id", id)
    .eq("shipper_id", ctx.shipperId)
    .select("id");
  const bad = checkWrite(res, "this rate wasn't found — reload to see your rates.");
  if (bad) return bad;

  revalidateRateViews();
  return saved("Rate updated.");
}

/** Show/hide one of the signed-in shipper's rates from buyers. */
export async function setShipperRateActive(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireApprovedShipper();
  if (!ctx) return notSaved(NOT_APPROVED);

  const id = str(formData.get("id"));
  if (!id) return notSaved("the form is missing the rate. Reload and try again.");
  const active = str(formData.get("active")) === "true";

  const res = await ctx.supabase
    .from("shipping_rates")
    .update({ active })
    .eq("id", id)
    .eq("shipper_id", ctx.shipperId)
    .select("id");
  const bad = checkWrite(res, "this rate wasn't found — reload to see your rates.");
  if (bad) return bad;

  revalidateRateViews();
  return saved(active ? "Rate shown to buyers." : "Rate hidden from buyers.");
}

/** Permanently remove one of the signed-in shipper's rates. */
export async function deleteShipperRate(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireApprovedShipper();
  if (!ctx) return notSaved(NOT_APPROVED);

  const id = str(formData.get("id"));
  if (!id) return notSaved("the form is missing the rate. Reload and try again.");

  const res = await ctx.supabase
    .from("shipping_rates")
    .delete()
    .eq("id", id)
    .eq("shipper_id", ctx.shipperId)
    .select("id");
  const bad = checkWrite(res, "this rate was already removed — reload to see your rates.");
  if (bad) return bad;

  revalidateRateViews();
  return saved("Rate removed.");
}

/**
 * Send the shipper to Stripe (Checkout in `setup` mode) to replace the card
 * ShipMova charges commission to. The shipper-commission webhook writes the new
 * Customer / PaymentMethod tokens back on `checkout.session.completed`.
 */
export async function startShipperCardSetup(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/shipper/portal");

  const admin = createAdminClient();
  const { data: shipper } = await admin
    .from("shippers")
    .select("id, company_name, contact_email, status, stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!shipper || shipper.status !== "approved") redirect("/shipper/portal");

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
      success_url: `${origin}/shipper/portal?card=updated`,
      cancel_url: `${origin}/shipper/portal?card=cancelled`,
    });
    redirectUrl = session.url ?? null;
  } catch (err) {
    console.error("startShipperCardSetup failed:", err);
    redirect("/shipper/portal?card=error");
  }

  if (!redirectUrl) redirect("/shipper/portal?card=error");
  redirect(redirectUrl);
}
