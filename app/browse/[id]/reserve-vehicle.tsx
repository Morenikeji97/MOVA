"use client";

import { type ComponentProps, type ReactNode } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Button, buttonClasses } from "@/components/ui/button";
import { reserveVehicle } from "./actions";

export type ReserveState = "anonymous" | "not-buyer" | "available" | "requested";

const REQUEST_STATUS_COPY: Record<string, string> = {
  submitted: "Submitted — waiting for MOVA to review.",
  under_review: "MOVA is reviewing your request.",
  verified: "Verified — MOVA will be in touch with next steps.",
  completed: "Completed.",
};

function PendingButton({
  children,
  pendingLabel,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="mt-10 rounded-lg border border-paper-200 bg-paper-100 p-6">
      {children}
    </div>
  );
}

export function ReserveVehicle({
  vehicleId,
  state,
  requestStatus,
}: {
  vehicleId: string;
  state: ReserveState;
  requestStatus: string | null;
}) {
  if (state === "requested") {
    return (
      <Card>
        <p className="text-ink-900">You&rsquo;ve requested to reserve this vehicle.</p>
        <p className="mt-1 text-sm text-slate-500">
          {(requestStatus && REQUEST_STATUS_COPY[requestStatus]) ??
            "MOVA will be in touch."}
        </p>
        <Link
          href="/buyer/dashboard"
          className="mt-3 inline-block text-sm text-marine-700 hover:underline"
        >
          View your dashboard &rarr;
        </Link>
      </Card>
    );
  }

  if (state === "anonymous") {
    return (
      <Card>
        <p className="text-ink-900">Interested in this vehicle?</p>
        <p className="mt-1 text-sm text-slate-500">
          Sign in with a buyer account to send MOVA a reservation request.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href={`/login?next=${encodeURIComponent(`/browse/${vehicleId}`)}`}
            className={buttonClasses({ size: "md" })}
          >
            Sign in to reserve
          </Link>
          <Link
            href="/signup"
            className="text-sm text-slate-500 hover:text-ink-900"
          >
            Create a buyer account
          </Link>
        </div>
      </Card>
    );
  }

  if (state === "not-buyer") {
    return (
      <Card>
        <p className="text-ink-900">Reserving is for buyer accounts.</p>
        <p className="mt-1 text-sm text-slate-500">
          Sign in with a buyer account to send MOVA a reservation request for
          this vehicle.
        </p>
      </Card>
    );
  }

  // available
  return (
    <Card>
      <p className="text-ink-900">Reserve this vehicle</p>
      <p className="mt-1 text-sm text-slate-500">
        This sends a reservation request to MOVA. The vehicle stays listed until
        our team confirms who proceeds.
      </p>
      <form action={reserveVehicle} className="mt-4">
        <input type="hidden" name="vehicleId" value={vehicleId} />
        <PendingButton pendingLabel="Sending request…">
          Reserve this vehicle
        </PendingButton>
      </form>
    </Card>
  );
}
