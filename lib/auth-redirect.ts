/**
 * MOVA — where an emailed auth link lands after /auth/confirm verifies it.
 *
 * Every auth email links to
 *   {{ .RedirectTo }}/auth/confirm?token_hash=…&type=<type>&next=<path>
 * (supabase/email-templates/). RedirectTo is the site the request came from
 * (shipmova.com in production, a deploy preview while testing), falling
 * back to the project's Site URL, so the link never shows a supabase.co
 * address. "/dashboard" in `next` means "the signed-in user's own
 * dashboard", resolved here from their role.
 */

export type EmailLinkType = "signup" | "email" | "magiclink" | "recovery" | "invite" | "email_change";

export const EMAIL_LINK_TYPES: readonly EmailLinkType[] = [
  "signup",
  "email",
  "magiclink",
  "recovery",
  "invite",
  "email_change",
];

export function isEmailLinkType(value: unknown): value is EmailLinkType {
  return EMAIL_LINK_TYPES.includes(value as EmailLinkType);
}

/** Shown for a link that's expired, already used, or malformed. */
export const LINK_EXPIRED_PATH = "/auth/link-expired";

/** The "your dashboard" placeholder the email templates use for `next`. */
export const DASHBOARD_PLACEHOLDER = "/dashboard";

export const ROLE_HOME: Record<string, string> = {
  buyer: "/buyer/dashboard",
  seller: "/seller/dashboard",
  admin: "/admin/dashboard",
};

/**
 * A same-site path, or null. Rejects absolute URLs, protocol-relative
 * "//evil.com", backslash tricks and anything not starting with "/", so a
 * crafted link can't bounce a freshly signed-in user to another site.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  if (/[\u0000-\u001f]/.test(next)) return null;
  return next;
}

/**
 * Where to send the user once the link has verified.
 *   recovery / invite            -> set a (new) password: /reset-password
 *   next is a real path          -> that path
 *   next missing or "/dashboard" -> the user's own dashboard by role, a
 *                                   shipper's dashboard, else home
 */
export function destinationAfterConfirm(opts: {
  type: EmailLinkType;
  next: string | null | undefined;
  role: string | null | undefined;
  isShipper?: boolean;
}): string {
  if (opts.type === "recovery" || opts.type === "invite") return "/reset-password";
  const next = safeNextPath(opts.next);
  if (next && next !== DASHBOARD_PLACEHOLDER) return next;
  if (opts.isShipper) return "/shipper/dashboard";
  return (opts.role && ROLE_HOME[opts.role]) || "/";
}
