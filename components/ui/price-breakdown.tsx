import { Handshake } from "lucide-react";
import { feeBreakdown, SELLER_SPLITS_FEE_BADGE } from "@/lib/fees";
import { cn } from "@/lib/utils";
import type { FeeResponsibility } from "@/types/database";
import { formatLocal, type FxCurrency, type FxRates } from "@/lib/fx-format";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

/**
 * Itemised buyer-facing price, from lib/fees.ts: car price, ShipMova's fee (8%,
 * or 4% when the seller splits it), Escrow.com's fee (estimate, its own
 * line), and the total before shipping. With `shipping`, the buyer's chosen
 * shipping cost is added below that and a total with shipping is shown.
 * Shipping is display-only — it's arranged with the shipper, not collected
 * through ShipMova. With `local`, the final total is also shown in those
 * currencies (lib/fx.ts); the page adds <FxNote> for the label and attribution.
 */
export function PriceBreakdown({
  price,
  feeResponsibility,
  shipping = null,
  variant = "card",
  local = null,
  className,
}: {
  price: number;
  feeResponsibility: FeeResponsibility;
  shipping?: { cost: number; label: string } | null;
  variant?: "card" | "detail";
  local?: { fx: FxRates | null; currencies: FxCurrency[] } | null;
  className?: string;
}) {
  const b = feeBreakdown(price, feeResponsibility);
  const detail = variant === "detail";
  const totalLabel =
    b.escrowFee === null ? "Total before escrow & shipping" : "Total before shipping";

  return (
    <dl
      className={cn(
        "flex flex-col gap-1",
        detail ? "text-sm" : "text-xs",
        className,
      )}
    >
      <Line label="Car price" value={usd.format(b.vehiclePrice)} />
      <Line
        label={
          <>
            ShipMova fee ({b.buyerRatePct}%)
            {b.split ? (
              <span className="text-muted"> · seller pays the other 4%</span>
            ) : null}
          </>
        }
        value={usd.format(b.buyerFee)}
      />
      <Line
        label="Escrow.com fee (est.)"
        value={b.escrowFee === null ? "Quoted by Escrow.com" : usd.format(b.escrowFee)}
      />
      <Total label={totalLabel} value={usd.format(b.totalBeforeShipping)} detail={detail} />
      {shipping ? (
        <>
          <Line label={`Shipping (${shipping.label})`} value={usd.format(shipping.cost)} />
          <Total
            label="Total with shipping"
            value={usd.format(b.totalBeforeShipping + shipping.cost)}
            detail={detail}
          />
        </>
      ) : null}
      {local?.fx ? (
        <div className="flex justify-end">
          <dt className="sr-only">In local currency</dt>
          <dd className={cn("text-right tabular-nums", detail ? "text-sm font-semibold text-ink" : "text-xs text-muted")}>
            {local.currencies.map((c) => (
              <span key={c} className="block">
                {formatLocal(b.totalBeforeShipping + (shipping?.cost ?? 0), c, local.fx!.rates[c])}
              </span>
            ))}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

function Line({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-muted">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function Total({ label, value, detail }: { label: string; value: string; detail: boolean }) {
  return (
    <div
      className={cn(
        "mt-1 flex items-baseline justify-between gap-4 border-t border-line pt-1 font-bold text-ink",
        detail ? "pt-2 text-xl" : "text-sm",
      )}
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

/** "Seller splits the fee" — shown wherever a split listing's badges are. */
export function SellerSplitsFeeBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-marine-50 px-2.5 py-1 text-sm font-medium text-marine-700",
        className,
      )}
    >
      <Handshake className="h-4 w-4" strokeWidth={2.5} />
      {SELLER_SPLITS_FEE_BADGE}
    </span>
  );
}
