"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { TotpEnroll } from "@/components/ui/totp-enroll";
import { MFA_SETTINGS_PATH } from "@/lib/admin-mfa-paths";

export function MfaGate({
  mode,
  destination,
}: {
  mode: "enroll" | "verify";
  destination: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      {mode === "enroll" ? (
        <>
          <div>
            <h1 className="text-2xl font-semibold text-black">Set up two-step sign-in</h1>
            <p className="mt-2 text-gray-500">
              Admin accounts need a code from an authenticator app, such as Google
              Authenticator, every time they sign in.
            </p>
          </div>
          <TotpEnroll
            friendlyName="Main authenticator"
            // Straight to the backup prompt — the moment to add one is now.
            onVerified={() => window.location.assign(`${MFA_SETTINGS_PATH}?new=1`)}
          />
        </>
      ) : (
        <VerifyCode destination={destination} />
      )}
      <SignOutLink />
    </div>
  );
}

function VerifyCode({ destination }: { destination: string }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setChecking(true);
    const supabase = createClient();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    // The code may come from any of the account's authenticators (main or
    // backup); each has its own secret, so try them in turn.
    for (const factor of factors?.totp ?? []) {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code: code.trim(),
      });
      if (!verifyError) {
        // Full navigation so every server component re-renders at aal2.
        window.location.assign(destination);
        return;
      }
    }
    setError("That code didn't work. Codes change every 30 seconds — enter the one showing now.");
    setChecking(false);
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold text-black">Enter your code</h1>
        <p className="mt-2 text-gray-500">
          Open your authenticator app and enter the 6-digit code for ShipMova.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          aria-label="6-digit code"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="h-11 rounded border border-gray-200 px-3 text-center font-mono text-base tracking-widest"
        />
        {error && <p className="text-sm text-copper-700">{error}</p>}
        <Button type="submit" disabled={checking || code.length !== 6}>
          {checking ? "Checking…" : "Continue"}
        </Button>
      </form>
      <p className="text-sm text-gray-500">
        Lost your phone? Use a code from your backup authenticator. No backup: follow
        docs/admin-mfa-recovery.md, which needs the Supabase dashboard.
      </p>
    </>
  );
}

function SignOutLink() {
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await createClient().auth.signOut();
    } catch {
      // Navigate regardless — the local session is cleared either way.
    }
    window.location.assign("/login");
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={signingOut}
      className="h-11 self-start text-sm text-gray-500 underline"
    >
      {signingOut ? "Signing out…" : "Sign out"}
    </button>
  );
}
