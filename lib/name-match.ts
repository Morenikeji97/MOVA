/**
 * ShipMova — does the name a buyer typed match their government ID record?
 *
 *   "match"    every name they typed is on the record (any order, ignoring
 *              case, accents, hyphens and punctuation), first and last
 *              included;
 *   "close"    the same, allowing one small spelling slip per name
 *              (e.g. "Oluwaseun" / "Oluwasegun", "Adeyemi" / "Adeyemmi");
 *   "mismatch" anything else — sent to the founder's review, never an
 *              automatic rejection.
 *
 * Only "match" and "close" verify a buyer automatically.
 */
export type NameMatch = "match" | "close" | "mismatch";

export type RecordName = {
  firstName: string | null;
  middleName?: string | null;
  lastName: string | null;
};

export function nameTokens(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/** Levenshtein distance, capped (we only care about 0, 1, 2). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

/** How many single-letter slips a name of this length may have. */
function allowedSlips(token: string): number {
  return token.length >= 5 ? 1 : 0;
}

export function matchName(typed: string, record: RecordName): NameMatch {
  const typedTokens = nameTokens(typed);
  const first = nameTokens(record.firstName ?? "");
  const last = nameTokens(record.lastName ?? "");
  const recordTokens = [...first, ...nameTokens(record.middleName ?? ""), ...last];
  if (typedTokens.length < 2 || first.length === 0 || last.length === 0) return "mismatch";

  let close = false;
  const used = new Set<number>();
  for (const t of typedTokens) {
    let best = -1;
    let bestDistance = Infinity;
    recordTokens.forEach((r, i) => {
      if (used.has(i)) return;
      const d = editDistance(t, r);
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    });
    if (best === -1 || bestDistance > allowedSlips(t)) return "mismatch";
    if (bestDistance > 0) close = true;
    used.add(best);
  }

  // The first and last names on the record must both be among what was typed.
  const firstIdx = new Set(first.map((_, i) => i));
  const lastIdx = new Set(last.map((_, i) => recordTokens.length - last.length + i));
  const hasFirst = [...firstIdx].some((i) => used.has(i));
  const hasLast = [...lastIdx].some((i) => used.has(i));
  if (!hasFirst || !hasLast) return "mismatch";

  return close ? "close" : "match";
}

/** The record's name as one string, for the reviewer to compare. */
export function recordFullName(record: RecordName): string {
  return [record.firstName, record.middleName, record.lastName].filter(Boolean).join(" ").trim();
}
