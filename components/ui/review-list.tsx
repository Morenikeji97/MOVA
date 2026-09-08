import { StarRating } from "@/components/ui/star-rating";
import { ReportReviewButton } from "@/components/ui/report-review-button";
import { REVIEWER_ROLE_LABEL } from "@/lib/reviews";
import type { ReviewType } from "@/types/database";

const fmtDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
});

export interface PublicReview {
  id: string;
  review_type: ReviewType;
  rating: number;
  comment: string | null;
  created_at: string;
}

/**
 * Published reviews for a profile. Reviewer identity is deliberately not shown
 * — only a neutral "Verified buyer / seller" role label. Any signed-in viewer
 * can report a review (routes to the admin queue).
 */
export function ReviewList({
  reviews,
  canReport = false,
  emptyLabel = "No reviews yet.",
}: {
  reviews: PublicReview[];
  canReport?: boolean;
  emptyLabel?: string;
}) {
  if (reviews.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-paper-200 bg-paper-100 p-6 text-center text-sm text-slate-500">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {reviews.map((r) => (
        <li
          key={r.id}
          className="rounded-lg border border-paper-200 bg-paper-100 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <StarRating value={r.rating} size="sm" />
              <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-ink-400">
                {REVIEWER_ROLE_LABEL[r.review_type]} ·{" "}
                {fmtDate.format(new Date(r.created_at))}
              </p>
            </div>
            {canReport ? <ReportReviewButton reviewId={r.id} /> : null}
          </div>
          {r.comment ? (
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-500">
              {r.comment}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
