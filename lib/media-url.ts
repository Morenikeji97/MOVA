/**
 * MOVA — show listing photos and videos from MOVA's own address.
 *
 * Files stay in Supabase Storage and the database keeps storing Supabase's
 * URL (the photo editor matches photos by that exact URL, so it must not
 * change). Only what goes into an <img>/<video> src is rewritten:
 *
 *   https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
 *     -> /media/<bucket>/<path>
 *   https://<project>.supabase.co/storage/v1/object/sign/<bucket>/<path>?token=…
 *     -> /media-signed/<bucket>/<path>?token=…
 *
 * /media and /media-signed are proxied back to Storage by netlify.toml (and
 * by next.config.ts rewrites locally). Relative, so they resolve against
 * whichever site is showing them — shipmova.com, or a deploy preview.
 * Anything that isn't one of this project's Storage URLs is left as is.
 */
const STORAGE_OBJECT_PATH = "/storage/v1/object/";

export function mediaUrl(
  url: string | null | undefined,
  supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): string {
  if (!url) return "";
  if (!supabaseUrl) return url;
  const base = supabaseUrl.replace(/\/+$/, "") + STORAGE_OBJECT_PATH;
  if (!url.startsWith(base)) return url;
  const rest = url.slice(base.length);
  if (rest.startsWith("public/")) return `/media/${rest.slice("public/".length)}`;
  if (rest.startsWith("sign/")) return `/media-signed/${rest.slice("sign/".length)}`;
  return url;
}
