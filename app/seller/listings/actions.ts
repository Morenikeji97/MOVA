"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canSubmitForReview } from "@/lib/listings-review";
import {
  ACTIVE_BUYER_MESSAGE,
  canSellerArchive,
  type PurchaseRequestSnapshot,
} from "@/lib/listing-removal";

/**
 * Move one of the seller's own draft listings into the review queue.
 * Bound to a <form action={submitForReview}> with a hidden `id` field.
 *
 * Pre-checks canSubmitForReview (lib/listings-review.ts) so a missing title
 * — or missing authorization document for a not-titled-owner seller — fails
 * as a clean no-op with a chance to show why, rather than relying solely on
 * the DB CHECK constraints (vehicles_title_photo_required_before_review /
 * vehicles_authorization_doc_required_before_review, migration 0031) to
 * reject the update outright. Those constraints remain the real backstop —
 * this is defense in depth, not a substitute for them.
 */
export async function submitForReview(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: listing } = await supabase
    .from("vehicles")
    .select("has_title_document, not_titled_owner, has_authorization_document")
    .eq("id", id)
    .eq("seller_id", user.id)
    .eq("status", "draft")
    .maybeSingle();
  if (!listing) return;
  if (
    !canSubmitForReview({
      hasTitleDocument: listing.has_title_document,
      notTitledOwner: listing.not_titled_owner,
      hasAuthorizationDocument: listing.has_authorization_document,
    })
  ) {
    return;
  }

  // The seller_id / status filters keep this to the caller's own drafts;
  // the vehicles RLS policy enforces the same ownership check server-side.
  await supabase
    .from("vehicles")
    .update({ status: "pending_review" })
    .eq("id", id)
    .eq("seller_id", user.id)
    .eq("status", "draft");

  revalidatePath("/seller/listings");
}

export type RemoveListingResult = { ok: true } | { ok: false; error: string };

/**
 * Seller-initiated withdrawal: move one of the seller's own listings to
 * 'archived' so it drops off /browse and the homepage.
 *
 * The real enforcement is in the database — "vehicles seller update own" RLS
 * confines the UPDATE to the caller's own rows, and
 * vehicles_guard_admin_only_fields (migration 0035) is what actually permits
 * draft/pending_review/approved/rejected -> archived and refuses everything
 * else, including any seller path to 'approved' or 'sold'. The checks here
 * exist to produce a sentence the seller can act on instead of a raw
 * constraint error, and the DB is re-checked afterwards because the guard can
 * revert a status without raising.
 */
export async function removeListing(vehicleId: string): Promise<RemoveListingResult> {
  if (typeof vehicleId !== "string" || vehicleId.length === 0) {
    return { ok: false, error: "Something went wrong. Please reload and try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in and try again." };

  const { data: listing } = await supabase
    .from("vehicles")
    .select("id, seller_id, status")
    .eq("id", vehicleId)
    .eq("seller_id", user.id)
    .maybeSingle();
  if (!listing) return { ok: false, error: "This listing isn't available." };

  const { data: requests } = await supabase
    .from("purchase_requests")
    .select("status, mova_fee_payment_status")
    .eq("vehicle_id", vehicleId);

  const check = canSellerArchive({
    status: listing.status,
    purchaseRequests: (requests ?? []) as PurchaseRequestSnapshot[],
  });
  if (!check.allowed) return { ok: false, error: check.message };

  const { error } = await supabase
    .from("vehicles")
    .update({ status: "archived" })
    .eq("id", vehicleId)
    .eq("seller_id", user.id);

  if (error) {
    // The guard raises with this message when a buyer turned up between the
    // check above and the write.
    if (error.message.includes("vehicle_has_active_buyer")) {
      return { ok: false, error: ACTIVE_BUYER_MESSAGE };
    }
    return { ok: false, error: "Could not remove the listing. Please try again." };
  }

  // The guard trigger reverts a disallowed status change without raising, so
  // a successful UPDATE isn't proof the status actually moved. Read it back.
  const { data: after } = await supabase
    .from("vehicles")
    .select("status")
    .eq("id", vehicleId)
    .maybeSingle();
  if (after?.status !== "archived") {
    return { ok: false, error: "Could not remove the listing. Please try again." };
  }

  revalidatePath("/seller/listings");
  revalidatePath(`/seller/listings/${vehicleId}/photos`);
  revalidatePath(`/browse/${vehicleId}`);
  revalidatePath("/browse");
  revalidatePath("/");

  return { ok: true };
}
