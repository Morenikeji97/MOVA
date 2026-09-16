"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DISPUTE_CATEGORIES } from "@/lib/disputes";
import type { DisputeCategory } from "@/types/database";

export type FileDisputeResult = { ok: true } | { ok: false; error: string };

/**
 * Files a dispute against a reservation — usable from either side (buyer
 * dashboard or seller reservations page), since filing logic doesn't differ
 * by which party is reporting. Implements the "Dispute Resolution Process"
 * promised in the Buyer Protection & Refund Policy (lib/policy-content.ts §6).
 *
 * Ownership ("must be the buyer or seller on this reservation") is also
 * enforced by the "disputes reporter insert" RLS policy, which additionally
 * pins status = 'open' and every decision column to null — the friendly
 * checks here are a UX nicety, not the security boundary. evidencePaths is
 * likewise re-checked against the caller's own storage folder before being
 * trusted, mirroring submitBankTransferProof (app/buyer/dashboard/actions.ts).
 */
export async function fileDispute(
  purchaseRequestId: string,
  category: DisputeCategory,
  description: string,
  evidencePaths: string[],
): Promise<FileDisputeResult> {
  if (typeof purchaseRequestId !== "string" || purchaseRequestId.length === 0) {
    return { ok: false, error: "Something went wrong. Please reload and try again." };
  }
  if (!DISPUTE_CATEGORIES.includes(category)) {
    return { ok: false, error: "Choose a category." };
  }
  const trimmedDescription = description.trim();
  if (trimmedDescription.length === 0) {
    return { ok: false, error: "Please describe the issue." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Please sign in and try again." };
  }

  const { data: pr } = await supabase
    .from("purchase_requests")
    .select("id, buyer_id, vehicle_id")
    .eq("id", purchaseRequestId)
    .maybeSingle();
  if (!pr) {
    return { ok: false, error: "This reservation isn't available." };
  }

  let isParty = pr.buyer_id === user.id;
  if (!isParty) {
    const { data: vehicle } = await supabase
      .from("vehicles")
      .select("seller_id")
      .eq("id", pr.vehicle_id)
      .maybeSingle();
    isParty = vehicle?.seller_id === user.id;
  }
  if (!isParty) {
    return { ok: false, error: "This reservation isn't available." };
  }

  const expectedPrefix = `${user.id}/`;
  const paths = evidencePaths.filter((p) => p.startsWith(expectedPrefix));

  const { error } = await supabase.from("disputes").insert({
    purchase_request_id: purchaseRequestId,
    reporter_id: user.id,
    category,
    description: trimmedDescription,
    evidence_paths: paths,
  });
  if (error) {
    console.error("fileDispute: insert failed", error);
    return { ok: false, error: "Couldn't file the dispute. Please try again." };
  }

  revalidatePath("/buyer/dashboard");
  revalidatePath("/seller/reservations");
  revalidatePath("/admin/disputes");
  return { ok: true };
}
