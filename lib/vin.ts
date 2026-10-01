/**
 * ShipMova — shared VIN validation.
 *
 * One definition, three consumers: the seller listing form's Zod schema
 * (app/seller/listings/new/page.tsx), the DB constraint on vehicles.vin
 * (vehicles_vin_valid, migration 0034 — which calls the SQL port of these
 * same rules), and the unit tests in lib/vin.test.ts.
 *
 * Context: the listing that triggered this work carried VIN
 * 1HGCM82633A004352 — Honda's widely published sample VIN, which is also
 * what the listing form used as its input placeholder. It passed the old
 * validation, which was a bare /^[A-HJ-NPR-Z0-9]{17}$/ shape check.
 */

/** Letters never used in a VIN: I, O and Q, to avoid 1/0 confusion. */
const VIN_ALLOWED_CHARS = /^[A-HJ-NPR-Z0-9]{17}$/;

export const VIN_LENGTH = 17;

/**
 * Known sample, demo and placeholder VINs. Extend this list — it is the one
 * place to add a new one.
 *
 * These are real, check-digit-valid VINs published in manufacturer and API
 * documentation, so no structural rule will ever catch them; they have to be
 * enumerated. Compared case-insensitively after trimming.
 */
export const BLOCKED_SAMPLE_VINS: readonly string[] = [
  "1HGCM82633A004352", // 2003 Honda Accord — NHTSA vPIC's own sample VIN,
                       // used in Honda/NHTSA docs and countless tutorials.
  "1HGBH41JXMN109186", // Honda sample VIN used across API docs and test data.
  "JH4TB2H26CC000000", // Acura sample VIN (NHTSA decoder examples).
  "WBA3A5C55CF256691", // BMW sample VIN in common circulation.
  "3VWFE21C04M000123", // VW sample VIN in common circulation.
  "WVWZZZ3BZWE689725", // VW Passat sample VIN (European docs).
  "1M8GDM9AXKP042788", // NHTSA "check digit" worked example.
  "11111111111111111",
  "12345678901234567",
];

/** ISO 3779 transliteration: each character's numeric value for the check digit. */
const TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
};

/** ISO 3779 positional weights; position 9 (the check digit itself) is 0. */
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * World Manufacturer Identifier regions that mandate the position-9 check
 * digit: North America (1-5). Everywhere else the digit is optional, and
 * plenty of legitimately imported vehicles fail it, so it is only enforced
 * for VINs whose first character says North America.
 */
function requiresCheckDigit(vin: string): boolean {
  return /^[1-5]/.test(vin);
}

/**
 * The ISO 3779 check digit for a 17-character VIN: weighted sum of the
 * transliterated characters, mod 11, where 10 is written as 'X'.
 */
export function computeCheckDigit(vin: string): string {
  let sum = 0;
  for (let i = 0; i < VIN_LENGTH; i++) {
    sum += (TRANSLITERATION[vin[i]] ?? 0) * WEIGHTS[i];
  }
  const remainder = sum % 11;
  return remainder === 10 ? "X" : String(remainder);
}

/** Why a VIN was rejected. Kept narrow so callers can map to their own copy. */
export type VinRejection =
  | "length"
  | "charset"
  | "check_digit"
  | "blocked_sample"
  | "repeated_character"
  | "sequential";

export type VinValidation =
  | { ok: true; vin: string }
  | { ok: false; reason: VinRejection };

/** Every character the same (AAAAAAAAAAAAAAAAA, 00000000000000000, …). */
function isRepeatedCharacter(vin: string): boolean {
  return new Set(vin).size === 1;
}

/**
 * Runs of ascending or descending consecutive characters covering most of the
 * VIN — "12345678901234567", "ABCDEFGHJKLMNPRST" and friends. Real VINs carry
 * a manufacturer prefix and a quasi-random serial, so a VIN that is one long
 * consecutive run is placeholder data. The alphabet used for "consecutive" is
 * the VIN charset itself, so the I/O/Q gaps don't break a run.
 */
const VIN_ALPHABET = "0123456789ABCDEFGHJKLMNPRSTUVWXYZ";

function isSequential(vin: string): boolean {
  const index = [...vin].map((c) => VIN_ALPHABET.indexOf(c));
  if (index.some((i) => i === -1)) return false;

  let ascending = 1;
  let descending = 1;
  let longestAscending = 1;
  let longestDescending = 1;
  for (let i = 1; i < index.length; i++) {
    const step = index[i] - index[i - 1];
    // Wrap-around ('...YZ0123...') still reads as a generated sequence.
    const ascStep = (step + VIN_ALPHABET.length) % VIN_ALPHABET.length;
    ascending = ascStep === 1 ? ascending + 1 : 1;
    descending = ascStep === VIN_ALPHABET.length - 1 ? descending + 1 : 1;
    longestAscending = Math.max(longestAscending, ascending);
    longestDescending = Math.max(longestDescending, descending);
  }
  // 12 of 17 characters in one run: comfortably past anything a real
  // manufacturer serial produces, while leaving room for the short ascending
  // runs that do occur naturally inside a genuine VIN.
  return Math.max(longestAscending, longestDescending) >= 12;
}

/**
 * Validates a VIN, normalising case and surrounding whitespace first.
 *
 * Order matters: shape before check digit (the digit is meaningless on a
 * malformed string), and the blocklist before the structural pattern checks
 * so a listed sample VIN always reports as `blocked_sample` rather than
 * whichever pattern rule happens to catch it.
 */
export function validateVin(input: string): VinValidation {
  const vin = input.trim().toUpperCase();

  if (vin.length !== VIN_LENGTH) return { ok: false, reason: "length" };
  if (!VIN_ALLOWED_CHARS.test(vin)) return { ok: false, reason: "charset" };
  if (BLOCKED_SAMPLE_VINS.some((b) => b.toUpperCase() === vin)) {
    return { ok: false, reason: "blocked_sample" };
  }
  if (isRepeatedCharacter(vin)) return { ok: false, reason: "repeated_character" };
  if (isSequential(vin)) return { ok: false, reason: "sequential" };
  if (requiresCheckDigit(vin) && computeCheckDigit(vin) !== vin[8]) {
    return { ok: false, reason: "check_digit" };
  }

  return { ok: true, vin };
}

/** Convenience predicate for callers that don't need the reason. */
export function isValidVin(input: string): boolean {
  return validateVin(input).ok;
}

/**
 * The single seller-facing message. Deliberately one line for every
 * rejection reason: telling a seller which rule their VIN broke mostly helps
 * someone iterating toward a VIN that passes, and the honest instruction is
 * the same in all cases — read it off the title again.
 */
export const VIN_ERROR_MESSAGE =
  "This VIN failed validation. Check it against your title.";
