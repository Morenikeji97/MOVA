import { AlertTriangle, CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import { cardClasses } from "@/components/ui/card";
import { IMPORT_COUNTRY_NAME, importStatusAll, modelYearFrom, type ImportStatus } from "@/lib/import-rules";
import { fetchRecalls } from "@/lib/recalls";
import { TITLE_HISTORY_LABEL, fetchTitleHistory } from "@/lib/vinaudit";
import { cn } from "@/lib/utils";

/** How many recall components to name before "and N more". */
const RECALLS_SHOWN = 3;

const IMPORT_ICON: Record<ImportStatus["kind"], { Icon: typeof CheckCircle2; tone: string }> = {
  importable: { Icon: CheckCircle2, tone: "text-verified-600" },
  borderline: { Icon: AlertTriangle, tone: "text-copper-700" },
  too_old: { Icon: XCircle, tone: "text-copper-700" },
  not_allowed: { Icon: XCircle, tone: "text-copper-700" },
  not_checked: { Icon: CircleHelp, tone: "text-muted" },
  unknown_year: { Icon: CircleHelp, tone: "text-muted" },
};

/**
 * Automatic checks on a listing (founder, 2026-10-08): import rules for each
 * country ShipMova ships to (lib/import-rules.ts), NHTSA safety recalls for
 * the model (lib/recalls.ts), and title history (VinAudit, a stub until the
 * key exists). Server component; wrap it in <Suspense> so a slow NHTSA
 * lookup never holds up the page.
 */
export async function ListingChecks({
  vehicle,
  vin = null,
  className,
}: {
  vehicle: {
    year: number;
    make: string;
    model: string;
    vin_model_year_code: string | null;
    title_status: string | null;
    accident_history: string | null;
  };
  /** Full VIN, for the title-history check (admin and the seller only). */
  vin?: string | null;
  className?: string;
}) {
  const modelYear = modelYearFrom(vehicle.vin_model_year_code, vehicle.year);
  const imports = importStatusAll(modelYear, {
    titleStatus: vehicle.title_status,
    accidentHistory: vehicle.accident_history,
  });
  const [recalls, titleHistory] = await Promise.all([
    fetchRecalls(vehicle.make, vehicle.model, modelYear),
    fetchTitleHistory(vin),
  ]);
  const parkIt = recalls.ok ? recalls.recalls.filter((r) => r.parkIt) : [];

  return (
    <section className={cardClasses({ className })} aria-labelledby="auto-checks-heading">
      <h2 id="auto-checks-heading" className="font-display text-lg font-bold text-ink">
        Automatic checks
      </h2>

      <h3 className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Import rules</h3>
      <ul className="mt-2 flex flex-col gap-3 text-sm">
        {imports.map((s) => {
          const { Icon, tone } = IMPORT_ICON[s.kind];
          return (
            <li key={s.country} className="flex gap-2">
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone)} aria-hidden />
              <div className="min-w-0">
                <p className="text-ink">
                  <span className="font-semibold">{IMPORT_COUNTRY_NAME[s.country]}:</span> {s.label}
                </p>
                {s.notes?.map((n) => (
                  <p key={n} className="text-muted">
                    {n}.
                  </p>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Safety recalls (NHTSA)</h3>
      {!recalls.ok ? (
        <p className="mt-2 text-sm text-muted">
          {"unrecognised" in recalls
            ? "NHTSA didn't recognise this make and model, so recalls weren't checked. "
            : "Couldn't check recalls just now. "}
          <a
            href="https://www.nhtsa.gov/recalls"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-2"
          >
            Look it up by VIN on nhtsa.gov
          </a>
        </p>
      ) : recalls.recalls.length === 0 ? (
        <p className="mt-2 text-sm text-ink">
          No recalls listed for the {modelYear} {vehicle.make} {vehicle.model}.
        </p>
      ) : (
        <div className="mt-2 text-sm">
          <p className="text-ink">
            NHTSA lists <strong>{recalls.recalls.length}</strong> recall
            {recalls.recalls.length === 1 ? "" : "s"} for the {modelYear} {vehicle.make} {vehicle.model}. Ask the
            seller whether they were repaired — a dealer can check by VIN.
          </p>
          {parkIt.length > 0 ? (
            <p className="mt-2 rounded-lg border border-copper-100 bg-copper-50 p-2 text-copper-700">
              {parkIt.length} of them say <strong>don&rsquo;t drive until repaired</strong>.
            </p>
          ) : null}
          <ul className="mt-2 list-disc pl-5 text-muted">
            {recalls.recalls.slice(0, RECALLS_SHOWN).map((r) => (
              <li key={r.campaign} className="break-words">
                {r.component.toLowerCase() || "Recall"} <span className="font-mono text-xs">({r.campaign})</span>
              </li>
            ))}
          </ul>
          {recalls.recalls.length > RECALLS_SHOWN ? (
            <p className="mt-1 text-muted">and {recalls.recalls.length - RECALLS_SHOWN} more.</p>
          ) : null}
          <a
            href="https://www.nhtsa.gov/recalls"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex h-11 items-center font-semibold text-ink underline underline-offset-2"
          >
            Look up recalls on nhtsa.gov
          </a>
        </div>
      )}

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Title history</h3>
      <p className="mt-2 text-sm text-muted">{TITLE_HISTORY_LABEL[titleHistory.status]}</p>
    </section>
  );
}

/** Same footprint while the checks load. */
export function ListingChecksFallback({ className }: { className?: string }) {
  return (
    <section className={cardClasses({ className })} aria-busy="true">
      <h2 className="font-display text-lg font-bold text-ink">Automatic checks</h2>
      <p className="mt-2 text-sm text-muted">Checking import rules and recalls…</p>
    </section>
  );
}
