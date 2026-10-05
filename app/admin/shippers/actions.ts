"use server";

import { revalidatePath } from "next/cache";
import { isServiceCountry, isVehicleSizeType, isShippingMethod } from "@/lib/shipping";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { SESSION_ENDED, checkWrite, notSaved, savedWithAudit, type ActionResult } from "@/lib/action-result";
import { notifyShipperVerificationDecision } from "@/lib/notifications";

/**
 * Admin actions for the shipper review queue. Bound to <form action={…}> with
 * hidden fields.
 *
 * middleware.ts gates /admin to role 'admin'; requireAdmin() re-checks here;
 * and the "shippers admin update" / "shipping rates admin write" RLS policies
 * (public.is_admin()) enforce it at the database.
 */

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

function revalidateShipperViews() {
  revalidatePath("/admin/shippers");
  revalidatePath("/admin/shipments");
  revalidatePath("/admin/dashboard");
}

/** Approve a pending shipper — their rates become visible to buyers. */
const MISSING_ID = "the form is missing the shipper. Reload and try again.";

export async function approveShipper(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = str(formData.get("id"));
  if (!id) return notSaved(MISSING_ID);

  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);

  const res = await ctx.supabase
    .from("shippers")
    .update({ status: "approved", reviewed_by: ctx.adminId, rejection_reason: null })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  // The database refuses approval without an approved, in-date insurance
  // certificate and a checked FMC license (0060).
  if (res.error?.message.includes("shipper_coi_required")) {
    return notSaved("approve an in-date insurance certificate first.");
  }
  if (res.error?.message.includes("shipper_license_required")) {
    return notSaved("check the FMC/OTI license on the FMC list first.");
  }
  const bad = checkWrite(res, "it's no longer pending — reload to see its current state.");
  if (bad) return bad;
  const audit = await logAdminAction(ctx.supabase, "shipper.approve", { table: "shippers", id });

  // Best-effort: if a ShipMova account already exists for the contact email and the
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
  return savedWithAudit("Shipper approved — their rates can now go live.", audit);
}

/** Reject a pending shipper and record why. A non-empty reason is required. */
export async function rejectShipper(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = str(formData.get("id"));
  const reason = str(formData.get("rejection_reason"));
  if (!id) return notSaved(MISSING_ID);
  if (!reason) return notSaved("add a reason for the rejection.");

  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);

  const res = await ctx.supabase
    .from("shippers")
    .update({ status: "rejected", rejection_reason: reason, reviewed_by: ctx.adminId })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  const bad = checkWrite(res, "it's no longer pending — reload to see its current state.");
  if (bad) return bad;

  const audit = await logAdminAction(ctx.supabase, "shipper.reject", { table: "shippers", id }, { reason });
  revalidateShipperViews();
  return savedWithAudit("Shipper rejected.", audit);
}

/**
 * Lift a suspension after manual review. Sets `reinstated_at` so the earlier
 * failed commissions no longer count toward re-suspension.
 */
export async function reinstateShipper(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = str(formData.get("id"));
  if (!id) return notSaved(MISSING_ID);

  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);

  const res = await ctx.supabase
    .from("shippers")
    .update({
      payment_status: "good_standing",
      reinstated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("payment_status", "suspended")
    .select("id");
  const bad = checkWrite(res, "this shipper isn't suspended — reload to see its current state.");
  if (bad) return bad;

  const audit = await logAdminAction(ctx.supabase, "shipper.reinstate", { table: "shippers", id });
  revalidateShipperViews();
  return savedWithAudit("Shipper reinstated.", audit);
}

/** Add a shipping rate for an approved shipper. Prices are shown to buyers as-is. */
export async function addShippingRate(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const shipperId = str(formData.get("shipper_id"));
  const originRegion = str(formData.get("origin_region"));
  const originPort = str(formData.get("origin_port"));
  const destinationCountry = str(formData.get("destination_country"));
  const vehicleSizeType = str(formData.get("vehicle_size_type"));
  const shippingMethod = str(formData.get("shipping_method"));
  const currency = str(formData.get("currency")).toUpperCase() || "USD";
  const price = Number(str(formData.get("price")));

  if (!shipperId) return notSaved(MISSING_ID);
  if (!originRegion) return notSaved("add the pickup region.");
  if (!isServiceCountry(destinationCountry)) return notSaved("choose a destination country.");
  if (!isVehicleSizeType(vehicleSizeType)) return notSaved("choose a vehicle size.");
  if (!isShippingMethod(shippingMethod)) return notSaved("choose a shipping method.");
  if (!Number.isFinite(price) || price < 0) return notSaved("the price must be a number, 0 or more.");

  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);

  const { data: shipper } = await ctx.supabase
    .from("shippers")
    .select("status")
    .eq("id", shipperId)
    .maybeSingle();
  if (shipper?.status !== "approved") return notSaved("rates can only be added for an approved shipper.");

  const res = await ctx.supabase.from("shipping_rates").insert({
    shipper_id: shipperId,
    origin_region: originRegion,
    origin_port: originPort || null,
    destination_country: destinationCountry,
    vehicle_size_type: vehicleSizeType,
    shipping_method: shippingMethod,
    price,
    currency,
  }).select("id");
  const bad = checkWrite(res);
  if (bad) return bad;

  const rateId = (res.data?.[0] as { id?: string } | undefined)?.id ?? null;
  const audit = await logAdminAction(ctx.supabase, "shipper.add_rate", { table: "shipping_rates", id: rateId }, {
    shipper_id: shipperId,
    destination_country: destinationCountry,
    vehicle_size_type: vehicleSizeType,
    shipping_method: shippingMethod,
    price,
    currency,
  });
  revalidateShipperViews();
  revalidatePath("/browse", "layout");
  return savedWithAudit("Rate added.", audit);
}

/** Remove a shipping rate. */
export async function deleteShippingRate(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = str(formData.get("id"));
  if (!id) return notSaved("the form is missing the rate. Reload and try again.");

  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);

  const res = await ctx.supabase.from("shipping_rates").delete().eq("id", id).select("id, shipper_id, price");
  const bad = checkWrite(res, "this rate was already removed — reload to see the list.");
  if (bad) return bad;

  const audit = await logAdminAction(ctx.supabase, "shipper.delete_rate", { table: "shipping_rates", id }, {
    removed: res.data?.[0] ?? null,
  });
  revalidateShipperViews();
  revalidatePath("/browse", "layout");
  return savedWithAudit("Rate removed.", audit);
}

/** Approve or reject a shipper's insurance certificate (a reason is required to reject). */
export async function decideShipperCoi(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = str(formData.get("id"));
  if (!id) return notSaved(MISSING_ID);
  const approve = str(formData.get("decision")) === "approve";
  const note = str(formData.get("note")).slice(0, 1000);
  if (!approve && !note) return notSaved("add a reason the shipper will see.");

  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);

  const res = await ctx.supabase
    .from("shippers")
    .update({
      coi_status: approve ? "approved" : "rejected",
      coi_reviewed_by: ctx.adminId,
      coi_reviewed_at: new Date().toISOString(),
      coi_review_note: approve ? null : note,
    })
    .eq("id", id)
    .eq("coi_status", "pending")
    .select("id, coi_expires_on");
  const bad = checkWrite(res, "this certificate was already decided — reload to see it.");
  if (bad) return bad;
  const audit = await logAdminAction(
    ctx.supabase,
    approve ? "shipper.coi_approve" : "shipper.coi_reject",
    { table: "shippers", id },
    { expires_on: res.data?.[0]?.coi_expires_on ?? null, ...(approve ? {} : { reason: note }) },
  );
  revalidateShipperViews();
  revalidatePath("/browse", "layout");
  await notifyShipperVerificationDecision(id, "coi", approve, approve ? null : note);
  return savedWithAudit(approve ? "Certificate approved." : "Certificate rejected — the shipper sees your reason.", audit);
}

/** Record the FMC/OTI license check: found active on the FMC's OTI list, or not found. */
export async function recordShipperLicenseCheck(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = str(formData.get("id"));
  if (!id) return notSaved(MISSING_ID);
  const result = str(formData.get("result"));
  if (result !== "active" && result !== "not_found") return notSaved("choose found or not found.");
  const note = str(formData.get("note")).slice(0, 1000);

  const ctx = await requireAdmin();
  if (!ctx) return notSaved(SESSION_ENDED);

  const res = await ctx.supabase
    .from("shippers")
    .update({ license_status: result, license_checked_by: ctx.adminId, license_checked_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, fmc_oti_license_number");
  const bad = checkWrite(res);
  if (bad) return bad;
  const audit = await logAdminAction(
    ctx.supabase,
    result === "active" ? "shipper.license_active" : "shipper.license_not_found",
    { table: "shippers", id },
    { license: res.data?.[0]?.fmc_oti_license_number ?? null, source: "FMC OTI list", ...(note ? { note } : {}) },
  );
  revalidateShipperViews();
  revalidatePath("/browse", "layout");
  await notifyShipperVerificationDecision(id, "license", result === "active", note || null);
  return savedWithAudit(result === "active" ? "License recorded as active on the FMC list." : "License recorded as not found.", audit);
}
