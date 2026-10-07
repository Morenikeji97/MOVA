"use client";

import { type ReactNode, useActionState } from "react";
import Link from "next/link";
import { Button, buttonClasses } from "@/components/ui/button";
import { AcceptPricePrompt } from "@/components/ui/accept-price-prompt";
import { reserveVehicle, type ReserveResult } from "./actions";

export type ReserveState = "anonymous" | "not-buyer" | "available" | "requested";

const usdCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const REQUEST_STATUS_COPY: Record<string, string> = {
  submitted: "Submitted — waiting for ShipMova to review.",
  under_review: "ShipMova is reviewing your request.",
  verified: "Verified — ShipMova will be in touch with next steps.",
  completed: "Completed.",
};

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-white p-5 shadow-card">
      {children}
    </div>
  );
}

export function ReserveVehicle({
  vehicleId,
  state,
  requestStatus,
  buyerFeeUsd,
  requestId,
  listingPriceUsd,
  negotiatedPriceUsd,
  negotiatedPriceStatus,
}: {
  vehicleId: string;
  state: ReserveState;
  requestStatus: string | null;
  buyerFeeUsd: number;
  requestId?: string | null;
  listingPriceUsd?: number;
  negotiatedPriceUsd?: number | null;
  negotiatedPriceStatus?: "none" | "proposed" | "accepted";
}) {
  const [result, formAction, pending] = useActionState<
    ReserveResult | null,
    FormData
  >(reserveVehicle, null);

  if (state === "requested") {
    return (
      <Card>
        <p className="font-display text-lg font-bold text-ink">You&rsquo;ve requested to reserve this vehicle.</p>
        <p className="mt-1 text-sm text-muted">
          {(requestStatus && REQUEST_STATUS_COPY[requestStatus]) ??
            "ShipMova will be in touch."}
        </p>

        {negotiatedPriceStatus === "proposed" &&
        negotiatedPriceUsd != null &&
        requestId &&
        listingPriceUsd != null ? (
          <AcceptPricePrompt
            purchaseRequestId={requestId}
            listingPriceUsd={listingPriceUsd}
            negotiatedPriceUsd={negotiatedPriceUsd}
          />
        ) : null}

        {negotiatedPriceStatus === "accepted" && negotiatedPriceUsd != null ? (
          <p className="mt-3 rounded-lg border border-verified-100 bg-verified-50 p-3 text-sm text-verified-600">
            You accepted{" "}
            {usdCents.format(negotiatedPriceUsd)} — ShipMova&rsquo;s service fee will
            be based on this price.
          </p>
        ) : null}

        <Link
          href="/buyer/dashboard"
          className="mt-2 flex h-11 w-fit items-center text-sm font-semibold text-ink hover:underline"
        >
          View your dashboard &rarr;
        </Link>
      </Card>
    );
  }

  if (state === "anonymous") {
    return (
      <Card>
        <p className="font-display text-lg font-bold text-ink">Interested in this vehicle?</p>
        <p className="mt-1 text-sm text-muted">
          Sign in with a buyer account to send ShipMova a reservation request.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Link
            href={`/login?next=${encodeURIComponent(`/browse/${vehicleId}`)}`}
            className={buttonClasses({ className: "w-full" })}
          >
            Sign in to reserve
          </Link>
          <Link
            href="/signup"
            className="flex h-11 items-center justify-center text-sm font-semibold text-muted hover:text-ink"
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
        <p className="font-display text-lg font-bold text-ink">Reserving is for buyer accounts.</p>
        <p className="mt-1 text-sm text-muted">
          Sign in with a buyer account to send ShipMova a reservation request for
          this vehicle.
        </p>
      </Card>
    );
  }

  // available
  return (
    <Card>
      <p className="font-display text-lg font-bold text-ink">Reserve this vehicle</p>
      <p className="mt-1 text-sm text-muted">
        This sends a reservation request to ShipMova. The vehicle stays listed until
        our team confirms who proceeds.
      </p>
      <p className="mt-2 text-sm text-muted">
        If ShipMova approves your reservation, you&rsquo;ll pay ShipMova&rsquo;s{" "}
        {usdCents.format(buyerFeeUsd)} fee, then the car price into Escrow.com.
        The seller is only paid once the car has passed inspection and your
        shipper has it and the original title.
      </p>
      <form action={formAction} className="mt-4">
        <input type="hidden" name="vehicleId" value={vehicleId} />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Sending request…" : "Reserve this vehicle"}
        </Button>
      </form>
      {result && !result.ok ? (
        <p className="mt-3 text-sm text-copper-700">{result.error}</p>
      ) : null}
      {result?.ok && result.created ? (
        <p className="mt-3 text-sm text-verified-600">
          Request sent — ShipMova will review it shortly.
        </p>
      ) : null}
    </Card>
  );
}
