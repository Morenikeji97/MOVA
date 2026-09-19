/**
 * Best-effort, client-side-only device signal for the referral program's
 * self-referral check (lib/referrals.ts) — NOT a strong device ID. It's
 * trivially spoofed by anyone who wants to (a fresh browser profile changes
 * most of these), same caveat as the IP-subnet and email-pattern checks it
 * sits alongside: one more signal that has to ALL be clear, not a security
 * boundary on its own.
 *
 * Split so the hash itself (pure) is testable without a DOM; only
 * collectDeviceSignal() touches browser globals.
 */

/** Non-cryptographic FNV-1a hash — fine for a best-effort comparison key, not for security. */
export function hashFingerprint(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

/** Call only in the browser (e.g. from a signup form's submit handler). */
export function collectDeviceFingerprint(): string {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "";
  const parts = [
    navigator.userAgent,
    navigator.language,
    String(window.screen?.width ?? ""),
    String(window.screen?.height ?? ""),
    String(window.screen?.colorDepth ?? ""),
    String(new Date().getTimezoneOffset()),
    String(navigator.hardwareConcurrency ?? ""),
  ];
  return hashFingerprint(parts.join("|"));
}
