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
  submitted: "Submitted — waiting for MOVA to review.",
  under_review: "MOVA is reviewing your request.",
  verified: "Verified — MOVA will be in touch with next steps.",
  completed: "Completed.",
};

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="mt-10 rounded-lg border border-gray-200 bg-white p-6">
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
        <p className="text-black">You&rsquo;ve requested to reserve this vehicle.</p>
        <p className="mt-1 text-sm text-gray-500">
          {(requestStatus && REQUEST_STATUS_COPY[requestStatus]) ??
            "MOVA will be in touch."}
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
          <p className="mt-3 rounded border border-verified-100 bg-verified-50 p-3 text-sm text-verified-600">
            You accepted{" "}
            {usdCents.format(negotiatedPriceUsd)} — MOVA&rsquo;s service fee will
            be based on this price.
          </p>
        ) : null}

        <Link
          href="/buyer/dashboard"
          className="mt-3 inline-block text-sm text-black hover:underline"
        >
          View your dashboard &rarr;
        </Link>
      </Card>
    );
  }

  if (state === "anonymous") {
    return (
      <Card>
        <p className="text-black">Interested in this vehicle?</p>
        <p className="mt-1 text-sm text-gray-500">
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
            className="text-sm text-gray-500 hover:text-black"
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
        <p className="text-black">Reserving is for buyer accounts.</p>
        <p className="mt-1 text-sm text-gray-500">
          Sign in with a buyer account to send MOVA a reservation request for
          this vehicle.
        </p>
      </Card>
    );
  }

  // available
  return (
    <Card>
      <p className="text-black">Reserve this vehicle</p>
      <p className="mt-1 text-sm text-gray-500">
        This sends a reservation request to MOVA. The vehicle stays listed until
        our team confirms who proceeds.
      </p>
      <p className="mt-2 text-sm text-gray-500">
        If MOVA approves your reservation, you&rsquo;ll pay a{" "}
        {usdCents.format(buyerFeeUsd)} MOVA service fee to unlock the seller&rsquo;s
        contact and payment details. The rest is wired to the seller directly.
      </p>
      <form action={formAction} className="mt-4">
        <input type="hidden" name="vehicleId" value={vehicleId} />
        <Button type="submit" disabled={pending}>
          {pending ? "Sending request…" : "Reserve this vehicle"}
        </Button>
      </form>
      {result && !result.ok ? (
        <p className="mt-3 text-sm text-copper-700">{result.error}</p>
      ) : null}
      {result?.ok && result.created ? (
        <p className="mt-3 text-sm text-verified-600">
          Request sent — MOVA will review it shortly.
        </p>
      ) : null}
    </Card>
  );
}
