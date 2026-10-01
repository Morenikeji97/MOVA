/** Admin two-step sign-in routes. No imports, so the middleware, client
 * components and node tests can all use it. See lib/admin-mfa.ts. */

export const MFA_PATH = "/mfa";

/** Where an admin manages their authenticators (add a backup, remove one). */
export const MFA_SETTINGS_PATH = "/admin/security";

/**
 * Paths an admin without a code-checked session can still reach: the code
 * page itself, sign-in (to switch accounts), and the emailed-link routes
 * (/auth/confirm must run to sign them in before the code is asked for).
 * Exact match or prefix + "/".
 */
const MFA_EXEMPT_PATHS = [MFA_PATH, "/login", "/auth"];

export function isMfaExempt(path: string): boolean {
  return MFA_EXEMPT_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}
