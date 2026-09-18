import { feeBreakdown } from "@/lib/fees";
import { cn } from "@/lib/utils";
import type { FeeResponsibility } from "@/types/database";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

/**
 * Itemised buyer-facing price: vehicle price, MOVA's service fee (8%, or 4%
 * when the seller splits it), optionally the buyer's chosen shipping cost,
 * and the total — which is the number MOVA shows as "the price" everywhere a
 * buyer sees it. `shipping` is display-only: this cost is still arranged and
 * paid directly with the shipper, not collected through MOVA's Stripe
 * Checkout (see 0018's migration comment) — it's here so the buyer sees a
 * true all-in total before committing, not a placeholder.
 */
export function PriceBreakdown({
  price,
  feeResponsibility,
  shipping = null,
  variant = "card",
  className,
}: {
  price: number;
  feeResponsibility: FeeResponsibility;
  shipping?: { cost: number; label: string } | null;
  variant?: "card" | "detail";
  className?: string;
}) {
  const b = feeBreakdown(price, feeResponsibility);
  const detail = variant === "detail";
  const total = shipping ? b.total + shipping.cost : b.total;

  return (
    <dl
      className={cn(
        "flex flex-col gap-1",
        detail ? "text-sm" : "text-xs",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-4 text-gray-500">
        <dt>Vehicle price</dt>
        <dd className="font-mono">{usd.format(b.vehiclePrice)}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-4 text-gray-500">
        <dt>
          MOVA service fee ({b.buyerRatePct}%)
          {b.split ? (
            <span className="text-gray-500"> · seller covers the other 4%</span>
          ) : null}
        </dt>
        <dd className="font-mono">{usd.format(b.buyerFee)}</dd>
      </div>
      {shipping ? (
        <div className="flex items-baseline justify-between gap-4 text-gray-500">
          <dt>Shipping ({shipping.label})</dt>
          <dd className="font-mono">{usd.format(shipping.cost)}</dd>
        </div>
      ) : null}
      <div
        className={cn(
          "mt-1 flex items-baseline justify-between gap-4 border-t border-gray-200 pt-1 font-semibold text-black",
          detail ? "text-lg" : "text-sm",
        )}
      >
        <dt>Total</dt>
        <dd className="font-mono">{usd.format(total)}</dd>
      </div>
    </dl>
  );
}
