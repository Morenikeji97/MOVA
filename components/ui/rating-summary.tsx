import { cn } from "@/lib/utils";
import { StarRating } from "@/components/ui/star-rating";
import { formatAvg, reviewCountLabel, type RatingAggregate } from "@/lib/reviews";

/**
 * Inline aggregate rating: stars + "4.8 · 12 reviews". Renders a muted
 * "No reviews yet" when there are none.
 */
export function RatingSummary({
  aggregate,
  size = "sm",
  className,
}: {
  aggregate: RatingAggregate;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  if (aggregate.count === 0 || aggregate.avg == null) {
    return (
      <span
        className={cn(
          "font-mono text-xs uppercase tracking-wider text-ink-400",
          className,
        )}
      >
        No reviews yet
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <StarRating value={aggregate.avg} size={size} />
      <span className="text-sm font-semibold text-ink-900">
        {formatAvg(aggregate.avg)}
      </span>
      <span className="font-mono text-xs text-ink-400">
        · {reviewCountLabel(aggregate.count)}
      </span>
    </span>
  );
}
