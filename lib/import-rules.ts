/**
 * ShipMova — can this car be imported to the buyer's country?
 *
 * Sources (verify with clearing agents; rules change):
 *   Nigeria — Customs 12-year rule (legit.ng, carawon.com, 2026).
 *   Ghana — Ghana Standards Authority, from 1 October 2026 (citinewsroom.com,
 *     2026-08): used vehicles more than 15 years old are barred, as are
 *     flood/water-, fire- and structurally damaged vehicles of any age; every
 *     used vehicle needs a Certificate of Conformity from a GSA-approved
 *     inspection in the exporting country. Customs (Amendment) Act 2020
 *     (Act 1014) also bars salvaged vehicles (damaged, without a clean
 *     title) and charges an over-age penalty above 10 years.
 *   Togo, Benin — sources disagree (2026-10-09: Togo 5, 8 or no years;
 *     Benin none, from trade sites only). Not encoded: "not yet confirmed",
 *     never a guess. docs/LAUNCH-BLOCKERS.md lists them to confirm.
 *
 * Age is checked by MODEL YEAR. A model year exactly at the cutoff is
 * borderline, because customs go by the manufacture date (on the driver's
 * door label), which can fall in the year before the model year.
 */

export type ImportCountry = "NG" | "GH" | "TG" | "BJ";

/** Nigeria's maximum age in years from manufacture. */
export const NIGERIA_MAX_AGE_YEARS = 12;

/** The oldest model year Nigeria accepts in `asOfYear` (2026 -> 2014). */
export function nigeriaCutoffYear(asOfYear: number = new Date().getFullYear()): number {
  return asOfYear - NIGERIA_MAX_AGE_YEARS;
}

export type ImportStatus = {
  kind: "importable" | "borderline" | "too_old" | "not_allowed" | "not_checked" | "unknown_year";
  country: ImportCountry;
  label: string;
  /** Extra things the buyer must know (a penalty, a required certificate). */
  notes?: string[];
};

export const NOT_CHECKED_LABEL = "Import rules not yet confirmed for this country — ask your clearing agent";

export const IMPORT_COUNTRY_NAME: Record<ImportCountry, string> = {
  NG: "Nigeria",
  GH: "Ghana",
  TG: "Togo",
  BJ: "Benin",
};

/** Ghana: oldest age (years) allowed from 1 Oct 2026, and the age above which Customs charges a penalty. */
export const GHANA_MAX_AGE_YEARS = 15;
export const GHANA_PENALTY_ABOVE_YEARS = 10;

/** What a listing says about damage (the seller's own answers). */
export type DamageFacts = { titleStatus?: string | null; accidentHistory?: string | null };

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

export function ghanaImportStatus(
  modelYear: number | null,
  damage: DamageFacts = {},
  asOfYear: number = new Date().getFullYear(),
): ImportStatus {
  const title = (damage.titleStatus ?? "").trim().toLowerCase();
  const accident = (damage.accidentHistory ?? "").trim().toLowerCase();
  const coc = "Needs a Certificate of Conformity from a Ghana Standards Authority-approved inspection before it ships";
  if (title === "flood") {
    return { kind: "not_allowed", country: "GH", label: "Can't be imported to Ghana: flood-damaged title" };
  }
  if (title === "salvage") {
    return { kind: "not_allowed", country: "GH", label: "Can't be imported to Ghana: salvage title" };
  }
  if (modelYear === null) {
    return { kind: "unknown_year", country: "GH", label: "Ghana import: model year unknown" };
  }
  const cutoff = asOfYear - GHANA_MAX_AGE_YEARS;
  if (modelYear < cutoff) {
    return { kind: "too_old", country: "GH", label: `Too old to import to Ghana (${cutoff}+ only)` };
  }
  const notes = [coc];
  if (asOfYear - modelYear > GHANA_PENALTY_ABOVE_YEARS) {
    notes.push(`Over ${GHANA_PENALTY_ABOVE_YEARS} years old: Ghana Customs charges an over-age penalty`);
  }
  if (title === "rebuilt" || accident === "severe damage") {
    return {
      kind: "borderline",
      country: "GH",
      label: "Check with your clearing agent — Ghana refuses salvaged and structurally damaged cars",
      notes,
    };
  }
  if (modelYear === cutoff) {
    return {
      kind: "borderline",
      country: "GH",
      label: "Borderline for Ghana — it goes by manufacture date. Check the date on the driver's door label",
      notes,
    };
  }
  return { kind: "importable", country: "GH", label: "Importable to Ghana ✓", notes };
}

export function importStatus(
  country: ImportCountry,
  modelYear: number | null,
  asOfYear: number = new Date().getFullYear(),
  damage: DamageFacts = {},
): ImportStatus {
  if (country === "NG") return nigeriaImportStatus(modelYear, asOfYear);
  if (country === "GH") return ghanaImportStatus(modelYear, damage, asOfYear);
  return { kind: "not_checked", country, label: NOT_CHECKED_LABEL };
}

/** All four countries, in the order buyers see them. */
export function importStatusAll(
  modelYear: number | null,
  damage: DamageFacts = {},
  asOfYear: number = new Date().getFullYear(),
): ImportStatus[] {
  return (["NG", "GH", "TG", "BJ"] as const).map((c) => importStatus(c, modelYear, asOfYear, damage));
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
