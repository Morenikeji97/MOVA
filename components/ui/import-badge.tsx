import { AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { modelYearFrom, nigeriaImportStatus } from "@/lib/import-rules";

/**
 * Nigeria import-eligibility badge for a listing, from lib/import-rules.ts.
 * Model year comes from the VIN's 10th character (vin_model_year_code),
 * falling back to the listing's year. Renders nothing if the year can't be
 * worked out.
 */
export function ImportBadge({
  vinModelYearCode,
  year,
  className,
}: {
  vinModelYearCode: string | null | undefined;
  year: number | null | undefined;
  className?: string;
}) {
  const status = nigeriaImportStatus(modelYearFrom(vinModelYearCode, year));
  if (status.kind === "unknown_year" || status.kind === "not_checked") return null;

  // The importable label already ends in "✓", so it gets no icon.
  const style =
    status.kind === "importable"
      ? { tone: "bg-verified-50 text-verified-600", Icon: null }
      : status.kind === "borderline"
        ? { tone: "bg-copper-50 text-copper-700", Icon: AlertTriangle }
        : { tone: "bg-band text-ink", Icon: XCircle };

  return (
    <span
      className={cn(
        "inline-flex items-start gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium",
        style.tone,
        className,
      )}
    >
      {style.Icon ? (
        <style.Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
      ) : null}
      {status.label}
    </span>
  );
}
