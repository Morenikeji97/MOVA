/**
 * ShipMova — the extra /browse filters the homepage search bar and category
 * chips link to (redesign PR B). Pure helpers; app/browse/page.tsx applies
 * them. Only categories our data can actually filter are offered:
 *   size  — vehicles.vehicle_size_type: "sedan" or "suv_truck" (SUVs and
 *           trucks are one shipping size, so they're one chip);
 *   fuel  — vehicles.fuel_type: hybrids (incl. plug-in) and electric.
 * There's no "luxury" field, so there's no Luxury chip.
 * No imports, so node tests can use it.
 */

export const BODY_FILTERS = {
  sedan: { label: "Sedan", sizeType: "sedan" },
  suv_truck: { label: "SUV & Truck", sizeType: "suv_truck" },
} as const;
export type BodyFilter = keyof typeof BODY_FILTERS;

export const FUEL_FILTERS = {
  hybrid: { label: "Hybrid", fuelTypes: ["Hybrid", "Plug-in hybrid"] },
  electric: { label: "Electric", fuelTypes: ["Electric"] },
} as const;
export type FuelFilter = keyof typeof FUEL_FILTERS;

/** The homepage chips, in order, as /browse links. */
export const CATEGORY_CHIPS: { label: string; href: string }[] = [
  ...Object.entries(BODY_FILTERS).map(([key, f]) => ({ label: f.label, href: `/browse?type=${key}` })),
  ...Object.entries(FUEL_FILTERS).map(([key, f]) => ({ label: f.label, href: `/browse?fuel=${key}` })),
];

export function parseBodyFilter(value: unknown): BodyFilter | null {
  return typeof value === "string" && Object.hasOwn(BODY_FILTERS, value) ? (value as BodyFilter) : null;
}

export function parseFuelFilter(value: unknown): FuelFilter | null {
  return typeof value === "string" && Object.hasOwn(FUEL_FILTERS, value) ? (value as FuelFilter) : null;
}

/**
 * The keyword box, as up to 4 words safe to put in a PostgREST filter:
 * letters, digits and hyphens only (no commas, brackets, wildcards or
 * quotes that could change the filter), each 1–30 characters.
 */
export function keywordTerms(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^-+|-+$/g, "").slice(0, 30))
    .filter(Boolean)
    .slice(0, 4);
}

/** One word must appear in the make, model or trim (PostgREST `or` filter). */
export function keywordOrFilter(term: string): string {
  return `make.ilike.%${term}%,model.ilike.%${term}%,trim.ilike.%${term}%`;
}
