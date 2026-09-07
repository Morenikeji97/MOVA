"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Destination = { label: string; href: string };

// buyer / seller / admin map straight to their dashboards. A "shipper" isn't a
// user role — it's a users row with a linked shippers record — so that link is
// added separately below.
const ROLE_DASHBOARD: Record<string, string> = {
  buyer: "/buyer/dashboard",
  seller: "/seller/dashboard",
  admin: "/admin/dashboard",
};

/**
 * Persistent account menu, mounted once in the root layout so it shows on every
 * page for any signed-in user, whatever their role. Renders nothing when
 * signed out. "Log out" calls Supabase sign-out and returns to the homepage.
 */
export function AccountMenu() {
  const [email, setEmail] = useState<string | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function hydrate(
      userId: string | null,
      userEmail: string | null | undefined,
    ) {
      if (!active) return;
      if (!userId) {
        setEmail(null);
        setDestinations([]);
        setOpen(false);
        return;
      }
      setEmail(userEmail ?? null);

      const [{ data: profile }, { data: shipper }] = await Promise.all([
        supabase.from("users").select("role").eq("id", userId).maybeSingle(),
        supabase
          .from("shippers")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);
      if (!active) return;

      const list: Destination[] = [];
      const role = profile?.role ?? null;
      if (role && ROLE_DASHBOARD[role]) {
        list.push({ label: "Dashboard", href: ROLE_DASHBOARD[role] });
      }
      if (shipper) list.push({ label: "Shipper portal", href: "/shipper" });
      if (list.length === 0) {
        list.push({ label: "Browse vehicles", href: "/browse" });
      }
      setDestinations(list);
    }

    // onAuthStateChange fires INITIAL_SESSION on subscribe, then on every
    // sign-in / sign-out, so this stays in sync without a separate getUser().
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void hydrate(session?.user?.id ?? null, session?.user?.email);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  async function logOut() {
    setLoggingOut(true);
    try {
      await createClient().auth.signOut();
    } catch {
      // Navigate home regardless — the local session is cleared either way.
    }
    // Full navigation so every server component re-renders signed-out.
    window.location.assign("/");
  }

  if (!email) return null;

  return (
    <div
      ref={boxRef}
      className="fixed bottom-4 left-4 z-50 sm:bottom-6 sm:left-6 print:hidden"
    >
      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute bottom-full left-0 mb-2 w-56 overflow-hidden rounded-lg border border-paper-200 bg-paper-100 py-1 text-sm shadow-lg"
        >
          <p className="truncate px-3.5 py-1.5 text-xs text-ink-400">{email}</p>
          <div className="my-1 border-t border-paper-200" />
          {destinations.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3.5 py-2 text-ink-900 hover:bg-paper-200"
            >
              {d.label}
            </Link>
          ))}
          <div className="my-1 border-t border-paper-200" />
          <button
            type="button"
            role="menuitem"
            onClick={logOut}
            disabled={loggingOut}
            className="block w-full px-3.5 py-2 text-left font-medium text-copper-700 hover:bg-paper-200 disabled:opacity-50"
          >
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-10 items-center gap-1.5 rounded-full border border-paper-200 bg-paper-100 pl-4 pr-3 text-sm font-medium text-ink-900 shadow-lg transition-colors hover:bg-paper-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marine-400 focus-visible:ring-offset-2"
      >
        Account
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={`h-3.5 w-3.5 fill-current transition-transform ${
            open ? "" : "rotate-180"
          }`}
        >
          <path d="M5.5 12.5 10 8l4.5 4.5z" />
        </svg>
      </button>
    </div>
  );
}
