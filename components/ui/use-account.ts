"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { serviceAccountKind } from "@/lib/account-kind";
import { accountDashboard, type AccountDashboard } from "@/lib/account-dashboard";

/**
 * The signed-in visitor for the header (desktop account menu and the phone
 * menu share one copy): their email, where "My dashboard" goes for their
 * role (lib/account-dashboard.ts), and sign out. `ready` is false until the
 * first auth callback, so the header doesn't flash "Sign In" at a signed-in
 * visitor.
 */
export function useAccount() {
  const [email, setEmail] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<AccountDashboard | null>(null);
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
        setDashboard(null);
        return;
      }
      setEmail(userEmail ?? null);

      const [{ data: profile }, { data: kind }, { data: buyer }] = await Promise.all([
        supabase.from("users").select("role").eq("id", userId).maybeSingle(),
        supabase.rpc("my_service_account_kind"),
        supabase.from("buyer_profiles").select("verification_status").eq("user_id", userId).maybeSingle(),
      ]);
      if (!active) return;

      setDashboard(
        accountDashboard({
          role: profile?.role ?? null,
          kind: serviceAccountKind(kind),
          buyerVerified: buyer?.verification_status === "verified",
        }),
      );
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

  return { ready, email, dashboard, loggingOut, logOut };
}
