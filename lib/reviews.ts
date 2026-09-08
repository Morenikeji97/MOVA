import type { ReviewType } from "@/types/database";

/** Longest a review comment may be (mirrors the DB CHECK). */
export const REVIEW_COMMENT_MAX = 2000;

export const REVIEW_TYPE_LABEL: Record<ReviewType, string> = {
  buyer_to_seller: "Buyer's review of the seller",
  seller_to_buyer: "Seller's review of the buyer",
  buyer_to_shipper: "Buyer's review of the shipper",
};

/** Neutral, privacy-preserving label for whoever wrote a published review. */
export const REVIEWER_ROLE_LABEL: Record<ReviewType, string> = {
  buyer_to_seller: "Verified buyer",
  seller_to_buyer: "Verified seller",
  buyer_to_shipper: "Verified buyer",
};

export interface RatingAggregate {
  avg: number | null;
  count: number;
}

/** Normalize a `*_ratings` view row (nullable numerics) to a clean aggregate. */
export function toAggregate(
  row: { avg_rating: number | null; review_count: number | null } | null | undefined,
): RatingAggregate {
  if (!row || row.review_count == null || row.review_count === 0) {
    return { avg: null, count: 0 };
  }
  return {
    avg: row.avg_rating == null ? null : Number(row.avg_rating),
    count: Number(row.review_count),
  };
}

/** "4.8" / "—" for display. */
export function formatAvg(avg: number | null): string {
  return avg == null ? "—" : avg.toFixed(1);
}

export function reviewCountLabel(count: number): string {
  return `${count} review${count === 1 ? "" : "s"}`;
}
