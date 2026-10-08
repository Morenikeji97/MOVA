/**
 * Display helpers for the city/state a seller typed (founder, 2026-10-08:
 * "New york" must show as "New York"). Display only; what was saved is left
 * as typed. No imports, so node tests can use it.
 */

/** Capitalises the first letter of each word; never lowercases anything,
 * so "McAllen" and "DC" survive. Words split on spaces, hyphens, dots and
 * apostrophes: "winston-salem" → "Winston-Salem", "st. louis" → "St. Louis". */
export function displayCity(city: string): string {
  return city
    .trim()
    .replace(/\s+/g, " ")
    .replace(/(^|[\s\-.'’])(\p{Ll})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** "New York, NY": the city capitalised, a two-letter state upper-cased. */
export function displayPlace(city: string, state: string): string {
  const s = state.trim();
  return `${displayCity(city)}, ${/^[a-z]{2}$/i.test(s) ? s.toUpperCase() : displayCity(s)}`;
}
