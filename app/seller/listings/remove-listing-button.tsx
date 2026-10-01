"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { removeListing } from "./actions";

/**
 * "Remove listing", with a confirm step.
 *
 * Two-stage inline confirmation rather than window.confirm: the wording needs
 * to say what removal actually does (drops off /browse, needs a fresh admin
 * review to come back) and whether it's reversible, which a native dialog
 * can't express.
 *
 * The button is rendered whenever the listing is in a withdrawable status;
 * the active-buyer case is not predicted here — the server action re-checks
 * against purchase_requests and returns the exact sentence to show, so the
 * seller sees the current answer rather than one baked into the page at
 * render time.
 */
export function RemoveListingButton({
  vehicleId,
  isLive,
  className,
}: {
  vehicleId: string;
  /** Approved listings are publicly visible, so the warning is stronger. */
  isLive: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await removeListing(vehicleId);
      if (!result.ok) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <div className={cn("flex flex-col items-start gap-2", className)}>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
        >
          Remove listing
        </Button>
        {error ? <p className="text-sm text-copper-700">{error}</p> : null}
      </div>
    );
  }

  return (
    <div
      role="alertdialog"
      aria-label="Confirm removing this listing"
      className={cn(
        "flex flex-col items-start gap-3 rounded border border-copper-100 bg-copper-50 p-4",
        className,
      )}
    >
      <p className="text-sm text-copper-700">
        Remove this listing?{" "}
        {isLive
          ? "Buyers will no longer see it anywhere on ShipMova."
          : "It will be taken out of your active listings."}{" "}
        Putting it back needs a fresh review by ShipMova.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onConfirm} disabled={pending}>
          {pending ? "Removing…" : "Yes, remove it"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setConfirming(false)}
          disabled={pending}
        >
          Keep it
        </Button>
      </div>
    </div>
  );
}
