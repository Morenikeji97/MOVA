"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/ui/auth-shell";
import { inputClasses } from "@/components/ui/input-classes";
import { CURRENT_POLICY_VERSION, BUYER_PROTECTION_POLICY_PATH } from "@/lib/policy";
import { collectDeviceFingerprint } from "@/lib/device-fingerprint";
import type { UserRole } from "@/types/database";
import { checkSignupRateLimit } from "./actions";

function SignupForm() {
  const searchParams = useSearchParams();
  const referralCode = searchParams.get("ref");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("buyer");
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!policyAccepted) return;
    setLoading(true);
    setError(null);

    const rateLimit = await checkSignupRateLimit();
    if (!rateLimit.ok) {
      setError(rateLimit.error ?? "Please try again shortly.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // handle_new_user() reads policy_version/referral_code/signup_ip/
        // signup_device_fingerprint the same way it already reads role —
        // see migrations 0013 and 0030. referral_code is silently ignored
        // if it doesn't match anyone's code (typo/stale link); the other
        // two are best-effort fraud signals for the referral program (see
        // lib/referrals.ts), never client-trusted for anything else.
        data: {
          role,
          policy_version: CURRENT_POLICY_VERSION,
          referral_code: referralCode ?? undefined,
          signup_ip: rateLimit.ip ?? undefined,
          signup_device_fingerprint: collectDeviceFingerprint() || undefined,
        },
        // The confirmation email links to {{ .RedirectTo }}/auth/confirm?…
        // (supabase/email-templates/confirm-signup.html), so this is the
        // bare origin: shipmova.com in production, the preview's own
        // address while testing.
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <AuthShell center>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Check your email</h1>
        <p className="mt-2 text-muted">
          We&apos;ve sent a verification link to {email}. Confirm your email to
          finish creating your ShipMova account.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="mb-6 font-display text-2xl font-extrabold tracking-tight text-ink">Create your ShipMova account</h1>
      {referralCode ? (
        <p className="mb-4 rounded-lg border border-line bg-band px-3 py-2 text-sm text-muted">
          Signing up with referral code <strong className="text-ink">{referralCode}</strong>.
        </p>
      ) : null}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <fieldset className="flex gap-2">
          {(["buyer", "seller"] as UserRole[]).map((r) => (
            <button
              type="button"
              key={r}
              onClick={() => setRole(r)}
              className={`h-11 flex-1 rounded-lg border text-sm font-semibold capitalize ${
                role === r
                  ? "border-ink bg-ink text-white"
                  : "border-line text-muted"
              }`}
            >
              I&apos;m a {r}
            </button>
          ))}
          {/* Shippers apply through a different form (company info, FMC OTI
              license, Stripe card capture), so this jumps straight there. */}
          <Link
            href="/shipper/signup"
            className="flex h-11 flex-1 items-center justify-center rounded-lg border border-line text-sm font-semibold text-muted"
          >
            I&apos;m a shipper
          </Link>
        </fieldset>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClasses()}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">Password</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClasses()}
          />
        </label>
        <label className="flex items-start gap-3 py-1 text-sm text-muted">
          <input
            type="checkbox"
            checked={policyAccepted}
            onChange={(e) => setPolicyAccepted(e.target.checked)}
            required
            className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
          />
          <span>
            I have read and agree to ShipMova&rsquo;s{" "}
            <Link
              href={BUYER_PROTECTION_POLICY_PATH}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink underline underline-offset-2"
            >
              Buyer Protection &amp; Refund Policy
            </Link>
            .
          </span>
        </label>
        {error && <p className="text-sm text-copper-700">{error}</p>}
        <Button type="submit" disabled={loading || !policyAccepted}>
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
