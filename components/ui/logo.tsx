import { cn } from "@/lib/utils";

/**
 * The ShipMova logo — the ONLY place pages reference logo files, so a
 * future logo change is one edit here plus new files in public/brand/.
 *
 *   kind="full" — the "M" mark with the SHIPMOVA wordmark (default)
 *   kind="mark" — the "M" mark alone
 *   tone="white" for dark backgrounds (default), "black" for light ones
 *
 * Files are flat vector traces of public/brand/shipmova-logo-original.png.
 * Favicons, the app icon and the Open Graph image live in app/ (icon.svg,
 * favicon.ico, apple-icon.png, opengraph-image.png); the email header logo
 * is public/brand/shipmova-email-logo.png.
 */
export const LOGO_SRC = {
  full: { white: "/brand/shipmova-logo-white.svg", black: "/brand/shipmova-logo-black.svg" },
  mark: { white: "/brand/shipmova-mark-white.svg", black: "/brand/shipmova-mark-black.svg" },
} as const;

/** Intrinsic aspect ratios (width / height) of the traced files. */
const ASPECT = { full: 1369 / 609, mark: 1096 / 438 } as const;

export function Logo({
  kind = "full",
  tone = "white",
  height = 40,
  className,
}: {
  kind?: "full" | "mark";
  tone?: "white" | "black";
  /** Rendered height in CSS pixels; width follows the aspect ratio. */
  height?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_SRC[kind][tone]}
      alt="ShipMova"
      width={Math.round(height * ASPECT[kind])}
      height={height}
      className={cn("w-auto", className)}
      style={{ height }}
    />
  );
}
