export type DojahLookupResult =
  | { status: "verified"; firstName: string | null; lastName: string | null }
  | { status: "failed" };

function dojahBaseUrl(): string {
  return process.env.DOJAH_BASE_URL ?? "https://sandbox.dojah.io";
}

function dojahHeaders(): Record<string, string> {
  const secretKey = process.env.DOJAH_SECRET_KEY;
  const appId = process.env.DOJAH_APP_ID;
  if (!secretKey || !appId) {
    throw new Error("DOJAH_SECRET_KEY / DOJAH_APP_ID are not set.");
  }
  return { Authorization: secretKey, AppId: appId };
}

async function lookup(path: string, param: string, value: string): Promise<DojahLookupResult> {
  const url = `${dojahBaseUrl()}${path}?${param}=${encodeURIComponent(value)}`;
  const res = await fetch(url, { headers: dojahHeaders() });

  if (!res.ok) {
    return { status: "failed" };
  }

  const body = await res.json().catch(() => null);
  const entity = body?.entity;
  if (!entity) {
    return { status: "failed" };
  }

  return {
    status: "verified",
    firstName: typeof entity.first_name === "string" ? entity.first_name : null,
    lastName: typeof entity.last_name === "string" ? entity.last_name : null,
  };
}

export function lookupNin(nin: string): Promise<DojahLookupResult> {
  return lookup("/api/v1/kyc/nin", "nin", nin);
}

export function lookupBvn(bvn: string): Promise<DojahLookupResult> {
  return lookup("/api/v1/kyc/bvn/full", "bvn", bvn);
}
