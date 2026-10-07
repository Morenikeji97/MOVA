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
 * The interactive right side of the shared header (components/ui/header.tsx):
 *   desktop (lg+): currency switcher + Sign In / Get Started, or the
 *                  Account dropdown;
 *   phones/tablets: one ≥44px menu button opening a full-screen menu with
 *                  the nav links, the currency switcher and the account links.
 * One useAccount() for both, so the auth state is read once.
 */
export function HeaderControls({
  navLinks,
  currency,
  getStartedHref,
}: {
  navLinks: NavLink[];
  currency: DisplayCurrency;
  getStartedHref: string;
}) {
  const account = useAccount();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  // Stable, so the menu's effects (scroll lock, focus) run once per opening.
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  return (
    <>
      <div className="hidden shrink-0 items-center gap-3 lg:flex">
        <CurrencySwitcher value={currency} />
        <DesktopAccount account={account} getStartedHref={getStartedHref} />
      </div>

      <button
        ref={menuButtonRef}
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-expanded={menuOpen}
        aria-controls="site-menu"
        className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/10 lg:hidden"
      >
        <MenuIcon size={24} />
        <span className="sr-only">Menu</span>
      </button>

      {menuOpen ? (
        <PhoneMenu
          navLinks={navLinks}
          currency={currency}
          getStartedHref={getStartedHref}
          account={account}
          onClose={closeMenu}
        />
      ) : null}
    </>
  );
}

type Account = ReturnType<typeof useAccount>;

function DesktopAccount({ account, getStartedHref }: { account: Account; getStartedHref: string }) {
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
  if (!account.ready) return <div className="h-11 w-40" aria-hidden />;

  if (!account.email) {
    return (
      <div className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold">
        <Link href="/login" className="flex h-11 items-center rounded-lg px-3 text-white hover:bg-white/10">
          Sign In
        </Link>
        <Link
          href={getStartedHref}
          className="flex h-11 items-center rounded-lg bg-white px-4 text-ink hover:bg-band"
        >
          Get Started
        </Link>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-11 items-center gap-1.5 whitespace-nowrap rounded-lg bg-white pl-4 pr-3 text-sm font-semibold text-ink hover:bg-band"
      >
        Account
        <ChevronDownIcon size={16} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-card border border-line bg-white py-1 text-sm shadow-card"
        >
          <p className="truncate px-4 py-2 text-xs text-muted">{account.email}</p>
          <div className="my-1 border-t border-line" />
          {account.destinations.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex h-11 items-center px-4 text-ink hover:bg-band"
            >
              {d.label}
            </Link>
          ))}
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            role="menuitem"
            onClick={account.logOut}
            disabled={account.loggingOut}
            className="flex h-11 w-full items-center px-4 text-left font-semibold text-ink hover:bg-band disabled:opacity-50"
          >
            {account.loggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PhoneMenu({
  navLinks,
  currency,
  getStartedHref,
  account,
  onClose,
}: {
  navLinks: NavLink[];
  currency: DisplayCurrency;
  getStartedHref: string;
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

  return (
    <div
      id="site-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className="fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-ink text-white lg:hidden"
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

      <nav aria-label="Main" className="px-4">
        {navLinks.map((link) => (
          <Link key={link.href} href={link.href} onClick={onClose} className={linkClass}>
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6 flex items-center justify-between gap-4 px-4">
        <span className="text-sm text-white/70">Show prices in</span>
        <CurrencySwitcher value={currency} />
      </div>

      <div className="mt-auto px-4 pb-8 pt-8">
        {!account.ready ? null : account.email ? (
          <div className="flex flex-col gap-2">
            <p className="truncate text-sm text-white/70">{account.email}</p>
            {account.destinations.map((d) => (
              <Link
                key={d.href}
                href={d.href}
                onClick={onClose}
                className="flex h-12 items-center justify-center rounded-lg bg-white px-4 font-semibold text-ink"
              >
                {d.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={account.logOut}
              disabled={account.loggingOut}
              className="flex h-12 items-center justify-center rounded-lg border border-white/40 px-4 font-semibold disabled:opacity-50"
            >
              {account.loggingOut ? "Logging out…" : "Log out"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Link
              href={getStartedHref}
              onClick={onClose}
              className="flex h-12 items-center justify-center rounded-lg bg-white px-4 font-semibold text-ink"
            >
              Get Started
            </Link>
            <Link
              href="/login"
              onClick={onClose}
              className="flex h-12 items-center justify-center rounded-lg border border-white/40 px-4 font-semibold"
            >
              Sign In
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
