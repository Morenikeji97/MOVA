/**
 * Fail fast, at client construction, when a Supabase key env var holds
 * something that isn't a Supabase API key.
 *
 * Without this, a wrong value (a JWT Signing Key ID / UUID pasted from the
 * dashboard's "JWT Keys" tab, an empty value, or a secret key leaked into a
 * NEXT_PUBLIC_ var) surfaces much later and far from its cause — as an opaque
 * "Invalid API key" from GoTrue on login, or "No API key found" from PostgREST.
 *
 * Accepted shapes:
 *   - new-format keys: `sb_publishable_…` (browser) / `sb_secret_…` (server)
 *   - legacy JWT keys: `eyJ…` (anon / service_role) — still valid until the
 *     legacy keys are disabled in the dashboard
 *
 * Runs in the browser and the Edge runtime, so: no `Buffer`, no Node APIs.
 */

type KeyKind = "publishable" | "secret";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Best-effort `role` claim from a legacy Supabase JWT. null if undecodable. */
function legacyJwtRole(key: string): string | null {
  try {
    const seg = key.split(".")[1];
    if (!seg) return null;
    const b64 = seg
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(seg.length / 4) * 4, "=");
    const payload = JSON.parse(atob(b64)) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

/**
 * Validate `key` for the given slot and return it unchanged. Throws a specific,
 * actionable Error otherwise.
 *
 * @param key      the raw env var value
 * @param kind     "publishable" for the browser/anon slot, "secret" for the
 *                 server-only RLS-bypassing slot
 * @param varName  the env var name, for the error message
 */
export function assertSupabaseKey(
  key: string | undefined,
  kind: KeyKind,
  varName: string,
): string {
  if (!key) {
    throw new Error(`${varName} is not set.`);
  }

  const isPublishable = key.startsWith("sb_publishable_");
  const isSecret = key.startsWith("sb_secret_");
  const isLegacyJwt = key.startsWith("eyJ");

  if (!isPublishable && !isSecret && !isLegacyJwt) {
    throw new Error(
      `${varName} does not look like a Supabase API key. ` +
        (UUID_RE.test(key)
          ? "It's a UUID — that's a JWT Signing Key ID from the dashboard's " +
            '"JWT Keys" tab, not an API key. Use the key from "API Keys → ' +
            'Publishable and secret API keys".'
          : "Expected sb_publishable_…, sb_secret_…, or a legacy eyJ… key."),
    );
  }

  if (kind === "publishable") {
    if (isSecret) {
      throw new Error(
        `${varName} is a SECRET key (sb_secret_…) exposed in a public/browser ` +
          `variable. Use the publishable key here, and rotate that secret.`,
      );
    }
    if (isLegacyJwt && legacyJwtRole(key) === "service_role") {
      throw new Error(
        `${varName} is a legacy service_role key exposed in a public/browser ` +
          `variable. Use the anon (publishable) key here, and rotate that key.`,
      );
    }
  }

  if (kind === "secret") {
    if (isPublishable) {
      throw new Error(
        `${varName} is a publishable key but is used server-side where a ` +
          `secret (RLS-bypassing) key is required. Use the sb_secret_… key.`,
      );
    }
    if (isLegacyJwt && legacyJwtRole(key) === "anon") {
      throw new Error(
        `${varName} is a legacy anon key but is used server-side where a ` +
          `service_role / secret key is required.`,
      );
    }
  }

  return key;
}
