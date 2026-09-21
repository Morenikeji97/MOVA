"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canSubmitForReview } from "@/lib/listings-review";

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
    .select("title_photo_path, not_titled_owner, authorization_document_path")
    .eq("id", id)
    .eq("seller_id", user.id)
    .eq("status", "draft")
    .maybeSingle();
  if (!listing) return;
  if (
    !canSubmitForReview({
      titlePhotoPath: listing.title_photo_path,
      notTitledOwner: listing.not_titled_owner,
      authorizationDocumentPath: listing.authorization_document_path,
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
