import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth-redirect";
import { redirectToPath } from "@/lib/relative-redirect";

/**
 * Older email-link landing route (code exchange). New emails use
 * /auth/confirm; this stays for links sent before that change.
 *
 * Redirects are relative paths (lib/relative-redirect.ts): behind Netlify,
 * request.url is the deploy's internal netlify.app address, not shipmova.com.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next")) ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return redirectToPath(next);
    }
  }

  return redirectToPath("/login?error=verification_failed");
}
