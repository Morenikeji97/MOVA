"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { proposeNegotiatedPrice } from "@/app/chat/actions";
import type { NegotiatedPriceStatus } from "@/types/database";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

/**
 * Seller's "propose a negotiated price" panel on a buyer's conversation page.
 * Shown only when the buyer has an open reservation on this vehicle. Lower-
 * only against the listing price is enforced both here (fast feedback) and,
 * for real, by the purchase_requests_guard_negotiation() trigger.
 */
export function NegotiatePricePanel({
  conversationId,
  listingPriceUsd,
  negotiatedPriceUsd,
  negotiatedPriceStatus,
}: {
  conversationId: string;
  listingPriceUsd: number;
  negotiatedPriceUsd: number | null;
  negotiatedPriceStatus: NegotiatedPriceStatus;
}) {
  const [price, setPrice] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const locked = negotiatedPriceStatus === "accepted";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(price);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a valid price.");
      return;
    }
    if (value >= listingPriceUsd) {
      setError(`Must be lower than the listing price (${usd.format(listingPriceUsd)}).`);
      return;
    }

    setPending(true);
    setError(null);
    setSent(false);
    const res = await proposeNegotiatedPrice(conversationId, value);
    setPending(false);
    if (res.ok) {
      setSent(true);
      setPrice("");
    } else {
      setError(res.error);
    }
  }

  return (
    <section className="mt-6 rounded-card border border-line bg-white shadow-card p-5">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
        Negotiated price
      </h2>
      <p className="mt-1 text-sm text-muted">
        Listing price: {usd.format(listingPriceUsd)}
      </p>

      {locked ? (
        <p className="mt-3 rounded-lg border border-verified-100 bg-verified-50 p-3 text-sm text-verified-600">
          The buyer accepted {negotiatedPriceUsd != null ? usd.format(negotiatedPriceUsd) : "your offer"}.
          ShipMova&rsquo;s fee will be based on this price.
        </p>
      ) : (
        <>
          {negotiatedPriceStatus === "proposed" && negotiatedPriceUsd != null ? (
            <p className="mt-2 text-sm text-muted">
              Current offer: {usd.format(negotiatedPriceUsd)} — waiting on the buyer.
              You can revise it below.
            </p>
          ) : null}
          <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-muted">Propose a price (USD)</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={pending}
                className="h-10 w-40 rounded-lg border border-line bg-white px-3 text-ink"
                placeholder={usd.format(listingPriceUsd)}
              />
            </label>
            <Button type="submit" size="sm" disabled={pending}>
              {pending
                ? "Sending…"
                : negotiatedPriceStatus === "proposed"
                  ? "Send revised offer"
                  : "Propose price"}
            </Button>
          </form>
          {error ? <p className="mt-2 text-sm text-copper-700">{error}</p> : null}
          {sent ? (
            <p className="mt-2 text-sm text-verified-600">
              Offer sent — the buyer needs to accept it before it takes effect.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
