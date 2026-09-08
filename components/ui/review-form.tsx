"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StarRatingInput } from "@/components/ui/star-rating";
import { submitReview, type SubmitReviewInput } from "@/app/reviews/actions";
import { REVIEW_COMMENT_MAX } from "@/lib/reviews";

/**
 * Review submission form. Only rendered by a page once it has server-confirmed
 * the viewer is eligible (completed transaction, not yet reviewed) — no
 * dead-end forms. The insert is still gated by RLS regardless.
 */
export function ReviewForm({
  target,
  counterpartyLabel,
  onSubmitted,
}: {
  target: Omit<SubmitReviewInput, "rating" | "comment">;
  counterpartyLabel: string;
  onSubmitted?: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <div className="rounded-lg border border-verified-100 bg-verified-50 p-4 text-sm text-verified-600">
        Thanks — your review of {counterpartyLabel} was submitted and will appear
        once MOVA has checked it.
      </div>
    );
  }

  return (
    <form
      className="rounded-lg border border-paper-200 bg-paper-100 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!rating || sending) return;
        setSending(true);
        setError(null);
        setBlockReason(null);
        const res = await submitReview({ ...target, rating, comment });
        setSending(false);
        if (res.ok) {
          setDone(true);
          onSubmitted?.();
        } else if ("blocked" in res) {
          setBlockReason(res.reason);
        } else {
          setError(res.error);
        }
      }}
    >
      <p className="text-sm font-semibold text-ink-900">
        Rate your experience with {counterpartyLabel}
      </p>

      <div className="mt-3">
        <StarRatingInput value={rating} onChange={setRating} disabled={sending} />
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={REVIEW_COMMENT_MAX}
        placeholder="How did it go? (optional)"
        className="mt-3 w-full resize-y rounded border border-paper-200 bg-paper-100 px-3 py-2 text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marine-400"
      />

      {blockReason ? (
        <p className="mt-2 rounded border border-copper-100 bg-copper-50 p-2 text-sm text-copper-700">
          {blockReason}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-copper-700">{error}</p> : null}

      <div className="mt-3 flex items-center gap-3">
        <Button type="submit" size="sm" disabled={!rating || sending}>
          {sending ? "Submitting…" : "Submit review"}
        </Button>
        <span className="font-mono text-[11px] text-ink-400">
          Phone numbers, emails and links aren&rsquo;t allowed in reviews.
        </span>
      </div>
    </form>
  );
}
