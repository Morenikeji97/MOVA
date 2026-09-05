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
 * when the seller splits it), and the total — which is the number MOVA shows
 * as "the price" everywhere a buyer sees it.
 */
export function PriceBreakdown({
  price,
  feeResponsibility,
  variant = "card",
  className,
}: {
  price: number;
  feeResponsibility: FeeResponsibility;
  variant?: "card" | "detail";
  className?: string;
}) {
  const b = feeBreakdown(price, feeResponsibility);
  const detail = variant === "detail";

  return (
    <dl
      className={cn(
        "flex flex-col gap-1",
        detail ? "text-sm" : "text-xs",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-4 text-slate-500">
        <dt>Vehicle price</dt>
        <dd className="font-mono">{usd.format(b.vehiclePrice)}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-4 text-slate-500">
        <dt>
          MOVA service fee ({b.buyerRatePct}%)
          {b.split ? (
            <span className="text-ink-400"> · seller covers the other 4%</span>
          ) : null}
        </dt>
        <dd className="font-mono">{usd.format(b.buyerFee)}</dd>
      </div>
      <div
        className={cn(
          "mt-1 flex items-baseline justify-between gap-4 border-t border-paper-200 pt-1 font-semibold text-ink-900",
          detail ? "text-lg" : "text-sm",
        )}
      >
        <dt>Total</dt>
        <dd className="font-mono">{usd.format(b.total)}</dd>
      </div>
    </dl>
  );
}
