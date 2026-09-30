/**
 * A redirect to a same-site path, sent as a RELATIVE Location header
 * ("/buyer/dashboard"), so the browser resolves it against the address it's
 * actually on — shipmova.com, a deploy preview, or localhost.
 *
 * Don't build redirects from request.url in route handlers: behind Netlify
 * it's the deploy's internal permalink
 * (https://<deploy-id>--mova-marketplace.netlify.app), not shipmova.com. A
 * redirect built from it sends the user off-site to an address where their
 * session cookie doesn't exist, and shows "netlify" in the address bar.
 *
 * A plain web Response (not NextResponse) so this stays testable outside
 * Next; route handlers accept it, and cookies set through next/headers
 * (the Supabase session) are still attached to it.
 */
export function redirectToPath(path: string, status: 303 | 307 = 307): Response {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new Error(`redirectToPath expects a same-site path, got ${JSON.stringify(path)}`);
  }
  return new Response(null, { status, headers: { Location: path } });
}
