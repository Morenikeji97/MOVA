import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared pieces for the signed-in dashboards and portals (redesign PR C).
 * Phone first: cards, not tables; ≥44px tap targets; the page's main action
 * pinned to the bottom of the screen on phones (StickyAction); nothing wider
 * than 320px.
 */

/** Light band page with a centred column. */
export function DashboardShell({
  children,
  narrow = false,
}: {
  children: ReactNode;
  /** Single-thread pages (a chat, a photo editor). */
  narrow?: boolean;
}) {
  return (
    <div className="min-h-screen bg-band">
      <main className={cn("mx-auto px-4 pb-10 pt-6 sm:px-6 sm:pb-14 sm:pt-10", narrow ? "max-w-3xl" : "max-w-4xl")}>
        {children}
      </main>
    </div>
  );
}

/** "← My listings" above a page title. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="-ml-1 inline-flex h-11 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-muted hover:text-ink"
    >
      <span aria-hidden>&larr;</span> {children}
    </Link>
  );
}

/**
 * Page title row. `action` sits on the right from sm up; on phones pass the
 * same action to <StickyAction> instead (it's hidden here below sm).
 */
export function DashboardHeader({
  eyebrow,
  title,
  intro,
  action,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  intro?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{eyebrow}</p>
        ) : null}
        <h1
          className={cn(
            "break-words font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl",
            eyebrow ? "mt-1" : null,
          )}
        >
          {title}
        </h1>
        {intro ? <p className="mt-2 text-sm text-muted sm:text-base">{intro}</p> : null}
      </div>
      {action ? <div className="hidden shrink-0 sm:block">{action}</div> : null}
    </div>
  );
}

/**
 * The page's main action, pinned to the bottom of the screen on phones while
 * the page scrolls (put it last inside <DashboardShell>). Hidden from sm up,
 * where the same action sits in <DashboardHeader>.
 */
export function StickyAction({ children }: { children: ReactNode }) {
  return (
    <div
      data-sticky-action
      className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-line bg-white/95 px-4 pt-3 backdrop-blur sm:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
    >
      {children}
    </div>
  );
}

/** A section heading inside a dashboard. */
export function DashboardSection({
  title,
  action,
  children,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mt-8", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export type PillTone = "neutral" | "info" | "success" | "warning";

const PILL: Record<PillTone, string> = {
  neutral: "bg-band text-muted",
  info: "bg-marine-50 text-marine-700",
  success: "bg-verified-50 text-verified-600",
  warning: "bg-copper-50 text-copper-700",
};

/** A status badge: words first, colour second (never colour alone). */
export function StatusPill({ tone = "neutral", children }: { tone?: PillTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
        PILL[tone],
      )}
    >
      {children}
    </span>
  );
}

const NOTICE: Record<PillTone, string> = {
  neutral: "border-line bg-white text-muted",
  info: "border-marine-100 bg-marine-50 text-marine-700",
  success: "border-verified-600/20 bg-verified-50 text-verified-600",
  warning: "border-copper-100 bg-copper-50 text-copper-700",
};

/** A coloured message box inside a card or page. */
export function Notice({
  tone = "neutral",
  children,
  className,
  role,
}: {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
  role?: "status" | "alert";
}) {
  return (
    <div role={role} className={cn("rounded-lg border p-3 text-sm", NOTICE[tone], className)}>
      {children}
    </div>
  );
}

/** An empty list: says what will appear here, and optionally what to do. */
export function EmptyCard({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-white p-8 text-center">
      <p className="font-display text-lg font-bold text-ink">{title}</p>
      {children ? <p className="mt-1 text-sm text-muted">{children}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** Big tappable tile linking to a dashboard area, with an optional count. */
export function DashboardTile({
  href,
  title,
  body,
  badge,
}: {
  href: string;
  title: ReactNode;
  body?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[4.5rem] items-center justify-between gap-3 rounded-card border border-line bg-white p-4 shadow-card transition-colors hover:border-ink"
    >
      <span className="min-w-0">
        <span className="block font-display text-lg font-bold text-ink">{title}</span>
        {body ? <span className="mt-0.5 block text-sm text-muted">{body}</span> : null}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {badge}
        <span aria-hidden className="text-xl text-muted">
          &rsaquo;
        </span>
      </span>
    </Link>
  );
}
