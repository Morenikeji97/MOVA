"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { scanForContactInfo, CONTACT_INFO_BLOCK_MESSAGE } from "@/lib/chat-filter";
import { REVIEW_COMMENT_MAX } from "@/lib/reviews";
import type { ReviewType } from "@/types/database";

export interface SubmitReviewInput {
  reviewType: ReviewType;
  rating: number;
  comment?: string;
  /** buyer_to_seller / seller_to_buyer */
  revieweeId?: string;
  purchaseRequestId?: string;
  /** buyer_to_shipper */
  revieweeShipperId?: string;
  shipmentRequestId?: string;
}

export type SubmitReviewResult =
  | { ok: true }
  | { ok: false; blocked: true; reason: string }
  | { ok: false; error: string };

const GENERIC_INELIGIBLE =
  "You can only review someone after a completed transaction with them.";

/**
 * Submit a review. Eligibility ("a completed transaction between exactly these
 * two parties") is enforced by the `reviews insert when eligible` RLS policy —
 * this action runs as the user, so a forged target/transaction just fails the
 * policy. The contact-info filter (shared with chat) runs here for a clear
 * inline message; the DB also has a coarse CHECK as a backstop.
 */
export async function submitReview(
  input: SubmitReviewInput,
): Promise<SubmitReviewResult> {
  const rating = Number(input?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "Pick a rating from 1 to 5 stars." };
  }
  const comment =
    typeof input.comment === "string" ? input.comment.trim() : "";
  if (comment.length > REVIEW_COMMENT_MAX) {
    return { ok: false, error: `Keep it under ${REVIEW_COMMENT_MAX} characters.` };
  }
  if (comment) {
    const scan = scanForContactInfo(comment);
    if (!scan.ok) {
      return {
        ok: false,
        blocked: true,
        reason: scan.message ?? CONTACT_INFO_BLOCK_MESSAGE,
      };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in to leave a review." };

  const base = {
    reviewer_id: user.id,
    rating,
    comment: comment || null,
    review_type: input.reviewType,
    status: "pending" as const,
  };

  let row: Record<string, unknown>;
  if (
    input.reviewType === "buyer_to_seller" ||
    input.reviewType === "seller_to_buyer"
  ) {
    if (!input.revieweeId || !input.purchaseRequestId) {
      return { ok: false, error: "Something went wrong. Please reload and try again." };
    }
    row = {
      ...base,
      reviewee_id: input.revieweeId,
      purchase_request_id: input.purchaseRequestId,
    };
  } else {
    if (!input.revieweeShipperId || !input.shipmentRequestId) {
      return { ok: false, error: "Something went wrong. Please reload and try again." };
    }
    row = {
      ...base,
      reviewee_shipper_id: input.revieweeShipperId,
      shipment_request_id: input.shipmentRequestId,
    };
  }

  const { error } = await supabase.from("reviews").insert(row as never);
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "You've already reviewed this transaction." };
    }
    if (error.code === "23514") {
      // reviews_comment_guard — contact info slipped past the JS filter.
      return {
        ok: false,
        blocked: true,
        reason: CONTACT_INFO_BLOCK_MESSAGE,
      };
    }
    if (error.code === "42501") {
      // RLS WITH CHECK denied — not eligible for this review.
      return { ok: false, error: GENERIC_INELIGIBLE };
    }
    console.error("submitReview: insert failed", error);
    return { ok: false, error: "We couldn't submit your review just now. Please try again." };
  }

  revalidatePath("/buyer/dashboard");
  revalidatePath("/seller/dashboard");
  revalidatePath("/admin/reviews");
  revalidatePath("/admin/dashboard");
  return { ok: true };
}

export type ReportReviewResult = { ok: true } | { ok: false; error: string };

/** Flag a published review for admin attention. RLS enforces "not your own". */
export async function reportReview(
  reviewId: string,
  reason?: string,
): Promise<ReportReviewResult> {
  if (typeof reviewId !== "string" || !reviewId) {
    return { ok: false, error: "Something went wrong." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in to report a review." };

  const trimmed = typeof reason === "string" ? reason.trim().slice(0, 500) : "";
  const { error } = await supabase.from("review_reports").insert({
    review_id: reviewId,
    reporter_id: user.id,
    reason: trimmed || null,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: true }; // already reported by this user — treat as done
    }
    if (error.code === "42501") {
      return { ok: false, error: "This review can't be reported." };
    }
    console.error("reportReview: insert failed", error);
    return { ok: false, error: "We couldn't submit your report just now." };
  }

  revalidatePath("/admin/reviews");
  revalidatePath("/admin/dashboard");
  return { ok: true };
}

// ── Admin moderation (form actions) ──────────────────────────────────────────

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

/** Publish or remove a review from the moderation queue. */
export async function moderateReview(formData: FormData): Promise<void> {
  const id = formData.get("id");
  const action = formData.get("action");
  const note = formData.get("note");
  if (typeof id !== "string" || !id) return;
  if (action !== "publish" && action !== "remove") return;

  const ctx = await requireAdmin();
  if (!ctx) return;

  await ctx.supabase
    .from("reviews")
    .update({
      status: action === "publish" ? "published" : "removed",
      moderated_by: ctx.adminId,
      moderated_at: new Date().toISOString(),
      moderation_note: typeof note === "string" && note.trim() ? note.trim() : null,
    })
    .eq("id", id)
    .in("status", ["pending", "flagged"]);

  // Close any open reports on this review.
  await ctx.supabase
    .from("review_reports")
    .update({
      status: "reviewed",
      resolved_by: ctx.adminId,
      resolved_at: new Date().toISOString(),
    })
    .eq("review_id", id)
    .eq("status", "open");

  revalidatePath("/admin/reviews");
  revalidatePath("/admin/dashboard");
}

/** Dismiss a report without changing the review (keeps it published). */
export async function dismissReports(formData: FormData): Promise<void> {
  const reviewId = formData.get("reviewId");
  if (typeof reviewId !== "string" || !reviewId) return;

  const ctx = await requireAdmin();
  if (!ctx) return;

  // A flagged-but-kept review goes back to published.
  await ctx.supabase
    .from("reviews")
    .update({
      status: "published",
      moderated_by: ctx.adminId,
      moderated_at: new Date().toISOString(),
    })
    .eq("id", reviewId)
    .eq("status", "flagged");

  await ctx.supabase
    .from("review_reports")
    .update({
      status: "dismissed",
      resolved_by: ctx.adminId,
      resolved_at: new Date().toISOString(),
    })
    .eq("review_id", reviewId)
    .eq("status", "open");

  revalidatePath("/admin/reviews");
  revalidatePath("/admin/dashboard");
}
