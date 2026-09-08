"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportReview } from "@/app/reviews/actions";

/** Small "Report" affordance on a published review; opens a one-field form. */
export function ReportReviewButton({ reviewId }: { reviewId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (state === "done") {
    return (
      <span className="font-mono text-[11px] uppercase tracking-wider text-verified-600">
        Reported
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-ink-400 hover:text-copper-700"
      >
        <Flag className="h-3 w-3" /> Report
      </button>
    );
  }

  return (
    <form
      className="flex w-56 flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        setError(null);
        const res = await reportReview(reviewId, reason);
        if (res.ok) {
          setState("done");
        } else {
          setState("error");
          setError(res.error);
        }
      }}
    >
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder="What's wrong with this review? (optional)"
        className="rounded border border-paper-200 bg-paper-100 px-2 py-1.5 text-xs text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marine-400"
      />
      {error ? <p className="text-xs text-copper-700">{error}</p> : null}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Send report"}
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-slate-500 hover:text-ink-900"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
