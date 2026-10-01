import { cn } from "@/lib/utils";
import { FX_ATTRIBUTION, formatFxUpdated, type FxRates } from "@/lib/fx-format";

/**
 * The rate label plus the attribution ExchangeRate-API requires on every page
 * that shows its rates. One per page, near the prices.
 */
export function FxNote({ fx, className }: { fx: FxRates | null; className?: string }) {
  if (!fx) return null;
  return (
    <p className={cn("text-xs text-gray-500", className)}>
      ≈ at today&rsquo;s reference rate · you pay in USD · updated {formatFxUpdated(fx.updatedAt)} ·{" "}
      <a href={FX_ATTRIBUTION.href} className="underline" rel="noopener" target="_blank">
        {FX_ATTRIBUTION.text}
      </a>
    </p>
  );
}
