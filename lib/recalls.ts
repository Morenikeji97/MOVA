/**
 * ShipMova — NHTSA safety recalls for a listing's make / model / model year
 * (https://api.nhtsa.gov/recalls/recallsByVehicle, free, no key).
 *
 * These are recalls for the MODEL, not proof that this car was or wasn't
 * repaired: the copy says so, and tells the buyer to ask the seller (a
 * dealer can check a VIN). Cached for a day per model; a failed or slow
 * lookup reads "couldn't check", never "no recalls".
 */

export type Recall = {
  campaign: string;
  component: string;
  summary: string;
  /** NHTSA "park it" flag: don't drive until repaired. */
  parkIt: boolean;
};

export type RecallResult =
  | { ok: true; recalls: Recall[] }
  /** NHTSA answered 400: it doesn't recognise this make/model/year. Not "no recalls". */
  | { ok: false; unrecognised: true }
  | { ok: false };

const ENDPOINT = "https://api.nhtsa.gov/recalls/recallsByVehicle";
const TIMEOUT_MS = 4000;
const ONE_DAY = 86_400;

/** Turns NHTSA's response into recalls; anything unexpected is a failed lookup. */
export function parseRecalls(body: unknown): RecallResult {
  if (!body || typeof body !== "object") return { ok: false };
  const results = (body as { results?: unknown }).results;
  if (!Array.isArray(results)) return { ok: false };
  const seen = new Set<string>();
  const recalls: Recall[] = [];
  for (const r of results) {
    if (!r || typeof r !== "object") continue;
    const x = r as Record<string, unknown>;
    const campaign = typeof x.NHTSACampaignNumber === "string" ? x.NHTSACampaignNumber : "";
    if (!campaign || seen.has(campaign)) continue;
    seen.add(campaign);
    recalls.push({
      campaign,
      component: typeof x.Component === "string" ? x.Component : "",
      summary: typeof x.Summary === "string" ? x.Summary : "",
      parkIt: x.parkIt === true,
    });
  }
  return { ok: true, recalls };
}

/** The lookup URL for one model year (make/model as the listing has them). */
export function recallsUrl(make: string, model: string, modelYear: number): string {
  const q = new URLSearchParams({ make: make.trim(), model: model.trim(), modelYear: String(modelYear) });
  return `${ENDPOINT}?${q.toString()}`;
}

export async function fetchRecalls(make: string, model: string, modelYear: number | null): Promise<RecallResult> {
  if (!make.trim() || !model.trim() || modelYear === null) return { ok: false };
  try {
    const res = await fetch(recallsUrl(make, model, modelYear), {
      next: { revalidate: ONE_DAY },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 400) return { ok: false, unrecognised: true };
    if (!res.ok) return { ok: false };
    return parseRecalls(await res.json());
  } catch (err) {
    console.error("NHTSA recall lookup failed:", err);
    return { ok: false };
  }
}
