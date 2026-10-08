"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { DisplayCurrency } from "@/lib/display-currency";
import { CurrencySwitcher } from "@/components/ui/currency-switcher";
import { ChevronDownIcon, CloseIcon, MenuIcon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/logo";
import { useAccount } from "@/components/ui/use-account";

export type NavLink = { label: string; href: string };

/**
 * The interactive right side of the shared header (components/ui/header.tsx).
 * Header rules (founder, 2026-10-08), every page:
 *
 *   signed out — "Sign In" and "Create account". Desktop: both on the right.
 *                Phones: a compact "Sign In" beside the menu button, and
 *                both at the top of the full-screen menu. Sign-up stays open
 *                before launch; the waitlist is an extra link, never a
 *                replacement.
 *   signed in  — "My dashboard" for their role (lib/account-dashboard.ts).
 *                Desktop: the button plus an Account menu ending in Sign out.
 *                Phones: "My dashboard" at the top of the menu, "Sign out"
 *                at the bottom.
 *
 * One useAccount() for both, so the auth state is read once.
 */
export function HeaderControls({
  navLinks,
  currency,
  waitlistHref,
}: {
  navLinks: NavLink[];
  currency: DisplayCurrency;
  /** Before launch only: "Join the waitlist" in the phone menu. */
  waitlistHref: string | null;
}) {
  const account = useAccount();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  // Stable, so the menu's effects (scroll lock, focus) run once per opening.
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  const signedOut = account.ready && !account.email;

  return (
    <>
      <div className="hidden shrink-0 items-center gap-3 lg:flex">
        <CurrencySwitcher value={currency} />
        <DesktopAccount account={account} />
      </div>

      <div className="flex shrink-0 items-center gap-1 lg:hidden">
        {signedOut ? (
          <Link
            href="/login"
            className="flex h-11 items-center whitespace-nowrap rounded-lg border border-white/40 px-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            Sign In
          </Link>
        ) : null}
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-expanded={menuOpen}
          aria-controls="site-menu"
          className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/10"
        >
          <MenuIcon size={24} />
          <span className="sr-only">Menu</span>
        </button>
      </div>

      {menuOpen ? (
        <PhoneMenu
          navLinks={navLinks}
          currency={currency}
          waitlistHref={waitlistHref}
          account={account}
          onClose={closeMenu}
        />
      ) : null}
    </>
  );
}

type Account = ReturnType<typeof useAccount>;

function DesktopAccount({ account }: { account: Account }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Nothing for the first instant, rather than "Sign In" flashing at a
  // signed-in visitor before the auth callback lands.
  if (!account.ready) return <div className="h-11 w-52" aria-hidden />;

  if (!account.email) {
    return (
      <div className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold">
        <Link href="/login" className="flex h-11 items-center rounded-lg px-3 text-white hover:bg-white/10">
          Sign In
        </Link>
        <Link href="/signup" className="flex h-11 items-center rounded-lg bg-white px-4 text-ink hover:bg-band">
          Create account
        </Link>
      </div>
    );
  }

  const dashboard = account.dashboard;

  return (
    <div ref={boxRef} className="relative flex items-center gap-2 whitespace-nowrap text-sm font-semibold">
      {dashboard ? (
        <Link
          href={dashboard.primary.href}
          className="flex h-11 items-center rounded-lg bg-white px-4 text-ink hover:bg-band"
        >
          {dashboard.primary.label}
        </Link>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-11 items-center gap-1.5 rounded-lg border border-white/40 pl-4 pr-3 text-white hover:bg-white/10"
      >
        Account
        <ChevronDownIcon size={16} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-card border border-line bg-white py-1 text-sm font-normal shadow-card"
        >
          <p className="truncate px-4 py-2 text-xs text-muted">Signed in as {account.email}</p>
          <div className="my-1 border-t border-line" />
          {dashboard
            ? [dashboard.primary, ...dashboard.extras].map((d) => (
                <Link
                  key={d.href}
                  href={d.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex h-11 items-center px-4 text-ink hover:bg-band"
                >
                  {d.label}
                </Link>
              ))
            : null}
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            role="menuitem"
            onClick={account.logOut}
            disabled={account.loggingOut}
            className="flex h-11 w-full items-center px-4 text-left font-semibold text-ink hover:bg-band disabled:opacity-50"
          >
            {account.loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PhoneMenu({
  navLinks,
  currency,
  waitlistHref,
  account,
  onClose,
}: {
  navLinks: NavLink[];
  currency: DisplayCurrency;
  waitlistHref: string | null;
  account: Account;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);
  const openedAt = useRef(pathname);

  // Close once a link has navigated somewhere else.
  useEffect(() => {
    if (pathname !== openedAt.current) onClose();
  }, [pathname, onClose]);

  // Full-screen: the page behind doesn't scroll; Escape closes; focus
  // starts on the close button.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const linkClass = "flex h-14 items-center border-b border-white/10 font-display text-2xl font-bold";
  const solid = "flex h-12 items-center justify-center rounded-lg bg-white px-4 font-semibold text-ink";
  const outline = "flex h-12 items-center justify-center rounded-lg border border-white/40 px-4 font-semibold";
  const signedIn = account.ready && !!account.email;

  return (
    <div
      id="site-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      // The bottom padding keeps "Sign out" clear of Safari's floating
      // toolbar and the home indicator: the menu scrolls rather than
      // hiding anything behind them.
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 6rem)" }}
      className="fixed inset-0 z-[100] flex flex-col overflow-y-auto overscroll-contain bg-ink text-white lg:hidden"
    >
      <div className="flex h-16 shrink-0 items-center justify-between px-4">
        <Link href="/" onClick={onClose} aria-label="ShipMova home" className="flex items-center">
          <Logo height={32} />
        </Link>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="-mr-2 flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10"
        >
          <CloseIcon size={24} />
          <span className="sr-only">Close menu</span>
        </button>
      </div>

      {/* Account first, so it's never below the fold. */}
      <div className="shrink-0 px-4 pb-4 pt-2">
        {!account.ready ? (
          <div className="h-12" aria-hidden />
        ) : signedIn ? (
          <div className="flex flex-col gap-2">
            <p className="truncate text-sm text-white/70">Signed in as {account.email}</p>
            {account.dashboard ? (
              <>
                <Link href={account.dashboard.primary.href} onClick={onClose} className={solid}>
                  {account.dashboard.primary.label}
                </Link>
                {account.dashboard.extras.map((d) => (
                  <Link key={d.href} href={d.href} onClick={onClose} className={outline}>
                    {d.label}
                  </Link>
                ))}
              </>
            ) : (
              <div className="h-12" aria-hidden />
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
              <Link href="/login" onClick={onClose} className={outline}>
                Sign In
              </Link>
              <Link href="/signup" onClick={onClose} className={solid}>
                Create account
              </Link>
            </div>
            {waitlistHref ? (
              <Link
                href={waitlistHref}
                onClick={onClose}
                className="flex h-11 items-center justify-center text-sm text-white/80 underline underline-offset-4"
              >
                Not ready yet? Join the waitlist
              </Link>
            ) : null}
          </div>
        )}
      </div>

      <nav aria-label="Main" className="shrink-0 border-t border-white/10 px-4">
        {navLinks.map((link) => (
          <Link key={link.href} href={link.href} onClick={onClose} className={linkClass}>
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6 flex shrink-0 items-center justify-between gap-4 px-4">
        <span className="text-sm text-white/70">Show prices in</span>
        <CurrencySwitcher value={currency} />
      </div>

      {signedIn ? (
        <div className="mt-8 shrink-0 px-4">
          <button
            type="button"
            onClick={account.logOut}
            disabled={account.loggingOut}
            className={cn(outline, "w-full disabled:opacity-50")}
          >
            {account.loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
