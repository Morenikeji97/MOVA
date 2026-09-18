"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { acceptNegotiatedPrice } from "@/app/chat/actions";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

/**
 * "Seller proposed $X, down from $Y" prompt with an Accept action. Shown to
 * the buyer wherever their reservation status appears (/buyer/dashboard,
 * /browse/[id]) whenever negotiated_price_status === 'proposed'. Accepting
 * updates the DB directly (RLS + the guard trigger enforce it's this buyer's
 * own reservation and that a proposal actually exists) — no silent effect
 * until the buyer explicitly clicks Accept.
 */
export function AcceptPricePrompt({
  purchaseRequestId,
  listingPriceUsd,
  negotiatedPriceUsd,
}: {
  purchaseRequestId: string;
  listingPriceUsd: number;
  negotiatedPriceUsd: number;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  async function accept() {
    setPending(true);
    setError(null);
    const res = await acceptNegotiatedPrice(purchaseRequestId);
    setPending(false);
    if (res.ok) setAccepted(true);
    else setError(res.error);
  }

  if (accepted) {
    return (
      <p className="mt-3 rounded border border-verified-100 bg-verified-50 p-3 text-sm text-verified-600">
        Accepted — {usd.format(negotiatedPriceUsd)}. MOVA&rsquo;s service fee will
        be based on this price.
      </p>
    );
  }

  return (
    <div className="mt-3 rounded border border-marine-100 bg-marine-50 p-4">
      <p className="text-sm font-medium text-marine-700">
        Seller proposed {usd.format(negotiatedPriceUsd)}, down from{" "}
        {usd.format(listingPriceUsd)}
      </p>
      <p className="mt-1 text-sm text-gray-500">
        Accepting locks in this price for your reservation — MOVA&rsquo;s service
        fee will be calculated from it instead of the listing price.
      </p>
      <Button type="button" size="sm" className="mt-3" onClick={accept} disabled={pending}>
        {pending ? "Accepting…" : `Accept ${usd.format(negotiatedPriceUsd)}`}
      </Button>
      {error ? <p className="mt-2 text-sm text-copper-700">{error}</p> : null}
    </div>
  );
}
