"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SERVICE_ACCOUNT_HOME, SERVICE_ACCOUNT_LABEL, serviceAccountKind } from "@/lib/account-kind";

type Destination = { label: string; href: string };

// buyer / seller / admin map straight to their dashboards. A "shipper" isn't a
// user role — it's a login linked to a shipper application/company
// (public.my_service_account_kind) — so those links are added separately below.
const ROLE_DASHBOARD: Record<string, string> = {
  buyer: "/buyer/dashboard",
  seller: "/seller/dashboard",
  admin: "/admin/dashboard",
};

/**
 * Account controls for the right side of the persistent header
 * (components/ui/header.tsx). Shows "Sign In" / "Create Account" when
 * signed out, or an account dropdown (dashboard links + log out) when
 * signed in. Inline (not floating) — it's a normal flex child of the
 * header's right-hand section, with the dropdown opening downward since
 * it now lives at the top of the page, not the bottom.
 */
export function AccountMenu() {
  const [email, setEmail] = useState<string | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [ready, setReady] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function hydrate(
      userId: string | null,
      userEmail: string | null | undefined,
    ) {
      if (!active) return;
      setReady(true);
      if (!userId) {
        setEmail(null);
        setDestinations([]);
        setOpen(false);
        return;
      }
      setEmail(userEmail ?? null);

      const [{ data: profile }, { data: kind }] = await Promise.all([
        supabase.from("users").select("role").eq("id", userId).maybeSingle(),
        supabase.rpc("my_service_account_kind"),
      ]);
      if (!active) return;

      const list: Destination[] = [];
      // A shipper login is a buyer-role account underneath but isn't a
      // buyer (lib/account-kind.ts): its portal and dashboard, never the
      // buyer dashboard. A seller who is also a shipper keeps theirs.
      const accountKind = serviceAccountKind(kind);
      if (accountKind === "shipper") {
        list.push({ label: SERVICE_ACCOUNT_LABEL.shipper, href: SERVICE_ACCOUNT_HOME.shipper });
        list.push({ label: "Shipper dashboard", href: "/shipper/dashboard" });
      }
      const role = profile?.role ?? null;
      if (role && ROLE_DASHBOARD[role] && !(accountKind && role === "buyer")) {
        list.push({ label: "Dashboard", href: ROLE_DASHBOARD[role] });
      }
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

  // Avoid a signed-out flash for a signed-in visitor while the auth listener's
  // first callback is still pending — render nothing for that first instant
  // rather than "Sign In" that then jumps to the account menu.
  if (!ready) return null;

  if (!email) {
    return (
      <div className="flex items-center gap-4 text-sm">
        <Link href="/login" className="text-white hover:text-gray-300">
          Sign In
        </Link>
        <Link
          href="/signup"
          className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-gray-200"
        >
          Create Account
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
        className="flex h-10 items-center gap-1.5 rounded-full bg-white pl-4 pr-3 text-sm font-medium text-black transition-colors hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      >
        Account
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={`h-3.5 w-3.5 fill-current transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          <path d="M5.5 7.5 10 12l4.5-4.5z" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg"
        >
          <p className="truncate px-3.5 py-1.5 text-xs text-gray-500">{email}</p>
          <div className="my-1 border-t border-gray-200" />
          {destinations.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3.5 py-2 text-black hover:bg-gray-100"
            >
              {d.label}
            </Link>
          ))}
          <div className="my-1 border-t border-gray-200" />
          <button
            type="button"
            role="menuitem"
            onClick={logOut}
            disabled={loggingOut}
            className="block w-full px-3.5 py-2 text-left font-medium text-black hover:bg-gray-100 disabled:opacity-50"
          >
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
