"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SERVICE_ACCOUNT_HOME, SERVICE_ACCOUNT_LABEL, serviceAccountKind } from "@/lib/account-kind";

export type Destination = { label: string; href: string };

// buyer / seller / admin map straight to their dashboards. A "shipper" isn't a
// user role — it's a login linked to a shipper application/company
// (public.my_service_account_kind) — so those links are added separately below.
const ROLE_DASHBOARD: Record<string, string> = {
  buyer: "/buyer/dashboard",
  seller: "/seller/dashboard",
  admin: "/admin/dashboard",
};

/**
 * The signed-in visitor for the header (desktop account menu and the phone
 * menu share one copy): their email, where their account links go, and log
 * out. `ready` is false until the first auth callback, so the header doesn't
 * flash "Sign In" at a signed-in visitor.
 */
export function useAccount() {
  const [email, setEmail] = useState<string | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [ready, setReady] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function hydrate(userId: string | null, userEmail: string | null | undefined) {
      if (!active) return;
      setReady(true);
      if (!userId) {
        setEmail(null);
        setDestinations([]);
        return;
      }
      setEmail(userEmail ?? null);

      const [{ data: profile }, { data: kind }] = await Promise.all([
        supabase.from("users").select("role").eq("id", userId).maybeSingle(),
        supabase.rpc("my_service_account_kind"),
      ]);
      if (!active) return;

      const list: Destination[] = [];
      // A shipper or inspector login is a buyer-role account underneath but
      // isn't a buyer (lib/account-kind.ts): its portal and dashboard, never
      // the buyer dashboard. A seller who is also a shipper keeps theirs.
      const accountKind = serviceAccountKind(kind);
      if (accountKind) {
        list.push({ label: SERVICE_ACCOUNT_LABEL[accountKind], href: SERVICE_ACCOUNT_HOME[accountKind] });
      }
      if (accountKind === "shipper") {
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

  return { ready, email, destinations, loggingOut, logOut };
}
