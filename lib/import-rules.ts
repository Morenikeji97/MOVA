/**
 * MOVA — can this car be imported to the buyer's country?
 *
 * Sources: Nigeria Customs 12-year rule (legit.ng, carawon.com, 2026). Verify with clearing agents.
 *
 *   Nigeria: a car may be at most 12 years old from its date of manufacture.
 *            Checked here by MODEL YEAR: model year > current year - 12 is
 *            importable; exactly current year - 12 is borderline, because
 *            Nigeria goes by the manufacture date (on the driver's door
 *            label), which can fall in the year before the model year.
 *   Ghana, Togo, Benin: no rule encoded yet — "not yet checked", never a guess.
 */

export type ImportCountry = "NG" | "GH" | "TG" | "BJ";

/** Nigeria's maximum age in years from manufacture. */
export const NIGERIA_MAX_AGE_YEARS = 12;

/** The oldest model year Nigeria accepts in `asOfYear` (2026 -> 2014). */
export function nigeriaCutoffYear(asOfYear: number = new Date().getFullYear()): number {
  return asOfYear - NIGERIA_MAX_AGE_YEARS;
}

export type ImportStatus =
  | { kind: "importable"; country: ImportCountry; label: string }
  | { kind: "borderline"; country: ImportCountry; label: string }
  | { kind: "too_old"; country: ImportCountry; label: string }
  | { kind: "not_checked"; country: ImportCountry; label: string }
  | { kind: "unknown_year"; country: ImportCountry; label: string };

export const NOT_CHECKED_LABEL = "Import rules not yet checked for this country";

export function nigeriaImportStatus(
  modelYear: number | null,
  asOfYear: number = new Date().getFullYear(),
): ImportStatus {
  if (modelYear === null) {
    return { kind: "unknown_year", country: "NG", label: "Nigeria import: model year unknown" };
  }
  const cutoff = nigeriaCutoffYear(asOfYear);
  if (modelYear > cutoff) {
    return { kind: "importable", country: "NG", label: "Importable to Nigeria ✓" };
  }
  if (modelYear === cutoff) {
    return {
      kind: "borderline",
      country: "NG",
      label:
        "Borderline — Nigeria goes by manufacture date. Check the date on the driver's door label",
    };
  }
  return {
    kind: "too_old",
    country: "NG",
    label: `Too old to import to Nigeria (${cutoff}+ only)`,
  };
}

export function importStatus(
  country: ImportCountry,
  modelYear: number | null,
  asOfYear: number = new Date().getFullYear(),
): ImportStatus {
  if (country === "NG") return nigeriaImportStatus(modelYear, asOfYear);
  return { kind: "not_checked", country, label: NOT_CHECKED_LABEL };
}

// ---------------------------------------------------------------------------
// Model year from the VIN
// ---------------------------------------------------------------------------

/**
 * VIN position 10 -> model year. The code repeats every 30 years (A = 1980
 * or 2010, 1 = 2001 or 2031), and I, O, Q, U, Z and 0 are never used.
 */
const YEAR_CODES = "ABCDEFGHJKLMNPRSTVWXY123456789";
const FIRST_CYCLE_START = 1980;

/**
 * Model year from the VIN's 10th character, falling back to the listing's
 * year field. The listing year only picks between the two 30-year
 * candidates (and is used outright when the VIN's code is missing or
 * invalid); a VIN that disagrees with the listing still wins.
 *
 *   ("E", 2014) -> 2014    ("E", null) -> 2014 (latest not in the future)
 *   ("0", 2015) -> 2015    (invalid code: listing year)
 */
export function modelYearFrom(
  vinYearCode: string | null | undefined,
  listingYear: number | null | undefined,
  asOfYear: number = new Date().getFullYear(),
): number | null {
  const code = (vinYearCode ?? "").trim().toUpperCase();
  const idx = code.length === 1 ? YEAR_CODES.indexOf(code) : -1;
  const listing =
    typeof listingYear === "number" && Number.isFinite(listingYear) ? listingYear : null;
  if (idx < 0) return listing;

  const candidates = [FIRST_CYCLE_START + idx, FIRST_CYCLE_START + 30 + idx].filter(
    (y) => y <= asOfYear + 1,
  );
  if (candidates.length === 0) return listing;
  if (listing === null) return Math.max(...candidates);
  return candidates.reduce((best, y) =>
    Math.abs(y - listing) < Math.abs(best - listing) ? y : best,
  );
}

/** The 10th character of a full VIN, or null. */
export function vinYearCode(vin: string | null | undefined): string | null {
  const v = (vin ?? "").trim();
  return v.length >= 10 ? v[9]!.toUpperCase() : null;
}
