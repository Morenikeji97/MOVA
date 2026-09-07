"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isServiceCountry } from "@/lib/shipping";

/**
 * Admin actions for the shipper review queue. Bound to <form action={…}> with
 * hidden fields.
 *
 * middleware.ts gates /admin to role 'admin'; requireAdmin() re-checks here;
 * and the "shippers admin update" / "shipping rates admin write" RLS policies
 * (public.is_admin()) enforce it at the database.
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

  return { supabase, adminId: user.id };
}

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

function revalidateShipperViews() {
  revalidatePath("/admin/shippers");
  revalidatePath("/admin/shipments");
  revalidatePath("/admin/dashboard");
}

/** Approve a pending shipper — their rates become visible to buyers. */
export async function approveShipper(formData: FormData): Promise<void> {
  const id = str(formData.get("id"));
  if (!id) return;

  const ctx = await requireAdmin();
  if (!ctx) return;

  await ctx.supabase
    .from("shippers")
    .update({ status: "approved", reviewed_by: ctx.adminId, rejection_reason: null })
    .eq("id", id)
    .eq("status", "pending");

  // Best-effort: if a MOVA account already exists for the contact email and the
  // shipper isn't linked yet, link it so the /shipper portal works right away.
  // Otherwise the shipper links it themselves via claimShipper. A failure here
  // (e.g. that account already owns another shipper) must not undo the approval.
  const { data: shipper } = await ctx.supabase
    .from("shippers")
    .select("contact_email, user_id, status")
    .eq("id", id)
    .maybeSingle();

  if (shipper?.status === "approved" && !shipper.user_id) {
    const { data: account } = await ctx.supabase
      .from("users")
      .select("id")
      .ilike("email", shipper.contact_email.replace(/([\\%_])/g, "\\$1"))
      .maybeSingle();
    if (account?.id) {
      const { error } = await ctx.supabase
        .from("shippers")
        .update({ user_id: account.id })
        .eq("id", id)
        .is("user_id", null);
      if (error) console.error("approveShipper auto-link skipped:", error.message);
    }
  }

  revalidateShipperViews();
}

/** Reject a pending shipper and record why. A non-empty reason is required. */
export async function rejectShipper(formData: FormData): Promise<void> {
  const id = str(formData.get("id"));
  const reason = str(formData.get("rejection_reason"));
  if (!id || !reason) return;

  const ctx = await requireAdmin();
  if (!ctx) return;

  await ctx.supabase
    .from("shippers")
    .update({ status: "rejected", rejection_reason: reason, reviewed_by: ctx.adminId })
    .eq("id", id)
    .eq("status", "pending");

  revalidateShipperViews();
}

/**
 * Lift a suspension after manual review. Sets `reinstated_at` so the earlier
 * failed commissions no longer count toward re-suspension.
 */
export async function reinstateShipper(formData: FormData): Promise<void> {
  const id = str(formData.get("id"));
  if (!id) return;

  const ctx = await requireAdmin();
  if (!ctx) return;

  await ctx.supabase
    .from("shippers")
    .update({
      payment_status: "good_standing",
      reinstated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("payment_status", "suspended");

  revalidateShipperViews();
}

/** Add a shipping rate for an approved shipper. Prices are shown to buyers as-is. */
export async function addShippingRate(formData: FormData): Promise<void> {
  const shipperId = str(formData.get("shipper_id"));
  const originRegion = str(formData.get("origin_region"));
  const originPort = str(formData.get("origin_port"));
  const destinationCountry = str(formData.get("destination_country"));
  const vehicleSizeType = str(formData.get("vehicle_size_type"));
  const currency = str(formData.get("currency")).toUpperCase() || "USD";
  const price = Number(str(formData.get("price")));

  if (!shipperId || !originRegion || !destinationCountry) return;
  if (!isServiceCountry(destinationCountry)) return;
  if (!Number.isFinite(price) || price < 0) return;

  const ctx = await requireAdmin();
  if (!ctx) return;

  const { data: shipper } = await ctx.supabase
    .from("shippers")
    .select("status")
    .eq("id", shipperId)
    .maybeSingle();
  if (shipper?.status !== "approved") return;

  await ctx.supabase.from("shipping_rates").insert({
    shipper_id: shipperId,
    origin_region: originRegion,
    origin_port: originPort || null,
    destination_country: destinationCountry,
    vehicle_size_type: vehicleSizeType || null,
    price,
    currency,
  });

  revalidateShipperViews();
  revalidatePath("/browse", "layout");
}

/** Remove a shipping rate. */
export async function deleteShippingRate(formData: FormData): Promise<void> {
  const id = str(formData.get("id"));
  if (!id) return;

  const ctx = await requireAdmin();
  if (!ctx) return;

  await ctx.supabase.from("shipping_rates").delete().eq("id", id);

  revalidateShipperViews();
  revalidatePath("/browse", "layout");
}
