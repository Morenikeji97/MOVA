/**
 * ShipMova — can this car be imported to the buyer's country?
 *
 * Every country's rule carries its source and the date ShipMova last
 * checked it (IMPORT_RULE_SOURCES below), and every line buyers see says
 * "confirm with your clearing agent": rules change, and ShipMova isn't the
 * authority. docs/LAUNCH-BLOCKERS.md lists them for the partner clearing
 * agents to confirm before launch.
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

export const NOT_CHECKED_LABEL = "Import rules not yet confirmed for this country";

export const IMPORT_COUNTRY_NAME: Record<ImportCountry, string> = {
  NG: "Nigeria",
  GH: "Ghana",
  TG: "Togo",
  BJ: "Benin",
};

/**
 * Where each rule comes from, and when ShipMova last checked it. `short` is
 * shown to buyers on every country line; `detail` is for staff and the
 * clearing agents confirming it.
 */
export const IMPORT_RULES_LAST_CHECKED = "2026-10-09";

export const IMPORT_RULE_SOURCES: Record<
  ImportCountry,
  { short: string; detail: string; url: string | null; lastChecked: string }
> = {
  NG: {
    short: "Federal Ministry of Finance, 2023 Fiscal Policy Measures (in force 1 Jun 2023)",
    detail:
      "Circular dated 20 Apr 2023, in force 1 Jun 2023: used vehicles manufactured more than 12 years ago are on the import prohibition list; Nigeria Customs announced the 12-year limit with its VIN Valuation System in May 2022. The Nigeria Trade Information Portal (tip.nsw.gov.ng, undated) still says 15 years.",
    url: "https://gazettengr.com/fg-bans-importation-of-vehicles-above-12-years-hikes-taxes-on-imported-wines-beers/",
    lastChecked: IMPORT_RULES_LAST_CHECKED,
  },
  GH: {
    short: "Ghana Standards Authority notice (in force 1 Oct 2026)",
    detail:
      "GSA public notice, Aug 2026, superseding its Jul 2026 notice (which said 10 years): from 1 Oct 2026 used vehicles more than 15 years old are barred, as are flood-, fire- and structurally damaged vehicles, vehicles assembled from parts and vehicles without a km/h speedometer; every used vehicle needs a Certificate of Conformity from a GSA-approved inspection in the exporting country. Reported by Citi Newsroom and GhanaWeb (no copy found on gsa.gov.gh). Customs (Amendment) Act 2020 (Act 1014) bars salvaged vehicles (damaged, without a clean title); Customs charges an over-age penalty above 10 years.",
    url: "https://www.citinewsroom.com/2026/08/no-more-importation-of-used-vehicles-15-years-and-older-from-october-1/",
    lastChecked: IMPORT_RULES_LAST_CHECKED,
  },
  TG: {
    short: "No reliable source found",
    detail:
      "Sources disagree: 5, 8 or no years for private cars; a 2018 cabinet decree planned a limit but never published one (Togo First, 18 Jan 2018).",
    url: null,
    lastChecked: IMPORT_RULES_LAST_CHECKED,
  },
  BJ: {
    short: "No official source found",
    detail: "Trade sites report no age limit for used vehicles; no government source found.",
    url: null,
    lastChecked: IMPORT_RULES_LAST_CHECKED,
  },
};

/** "9 Oct 2026" for a YYYY-MM-DD date. */
export function formatCheckedDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[m - 1]} ${y}`;
}

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
  const coc = "Needs a Certificate of Conformity from a Ghana Standards Authority-approved inspection before it ships, and a speedometer that shows km/h";
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
    notes.push(`Over ${GHANA_PENALTY_ABOVE_YEARS} years old: Ghana Customs may charge an over-age penalty`);
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
