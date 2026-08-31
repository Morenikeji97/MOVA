"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/**
 * Submit button for the <form action={submitForReview}> on the listings list.
 * Uses the form's pending status to disable itself and show a loading label
 * while the request is in flight, so a double-click can't fire the action twice.
 */
export function SubmitForReviewButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="sm" disabled={pending}>
      {pending ? "Submitting…" : "Submit for review"}
    </Button>
  );
}
