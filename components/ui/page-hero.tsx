import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The dark hero at the top of the public landing pages (/sell, /shipper,
 * /inspectors, /how-it-works, /referrals, /clearing-agents). Same type and
 * colours as the homepage hero (redesign PR B), without the photo.
 */
export function PageHero({
  eyebrow,
  title,
  intro,
  narrow = false,
  children,
}: {
  /** Match a page whose sections are max-w-4xl. */
  narrow?: boolean;
  eyebrow?: ReactNode;
  title: ReactNode;
  intro?: ReactNode;
  /** Buttons: full width and stacked on phones, side by side from sm up. */
  children?: ReactNode;
}) {
  return (
    <section className="bg-ink text-white">
      <div className={cn("mx-auto px-4 py-14 sm:px-6 sm:py-20", narrow ? "max-w-4xl" : "max-w-6xl")}>
        {eyebrow ? (
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">{eyebrow}</p>
        ) : null}
        <h1 className="max-w-3xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        {intro ? <p className="mt-5 max-w-xl text-base text-white/80 sm:text-lg">{intro}</p> : null}
        {children ? <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{children}</div> : null}
      </div>
    </section>
  );
}

/** Buttons on the dark hero: solid white, or white outline. */
export function heroButtonClasses(variant: "solid" | "outline" = "solid", className?: string) {
  return cn(
    "inline-flex h-12 items-center justify-center gap-2 rounded-lg px-6 text-base font-semibold transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink",
    variant === "solid" ? "bg-white text-ink hover:bg-band" : "border border-white/60 text-white hover:bg-white/10",
    className,
  );
}

/** A section heading in the homepage style: optional eyebrow, Archivo title, intro. */
export function SectionHeading({
  eyebrow,
  title,
  intro,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  intro?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{eyebrow}</p>
      ) : null}
      <h2 className={cn("font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl", eyebrow ? "mt-2" : null)}>
        {title}
      </h2>
      {intro ? <p className="mt-3 text-muted">{intro}</p> : null}
    </div>
  );
}
