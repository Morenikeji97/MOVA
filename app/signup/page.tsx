"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { CURRENT_POLICY_VERSION, BUYER_PROTECTION_POLICY_PATH } from "@/lib/policy";
import type { UserRole } from "@/types/database";
import { checkSignupRateLimit } from "./actions";

export default function SignupPage() {
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
        // handle_new_user() reads policy_version the same way it already
        // reads role, and creates the buyer_profiles/seller_profiles row +
        // the signup policy_acceptances audit row atomically at account
        // creation — see migration 0013.
        data: { role, policy_version: CURRENT_POLICY_VERSION },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
        <h1 className="text-2xl font-semibold text-ink-900">Check your email</h1>
        <p className="mt-2 text-slate-500">
          We&apos;ve sent a verification link to {email}. Confirm your email to
          finish creating your MOVA account.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="mb-6 text-2xl font-semibold text-ink-900">Create your MOVA account</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <fieldset className="flex gap-2">
          {(["buyer", "seller"] as UserRole[]).map((r) => (
            <button
              type="button"
              key={r}
              onClick={() => setRole(r)}
              className={`h-11 flex-1 rounded border text-sm font-medium capitalize ${
                role === r
                  ? "border-marine bg-marine-50 text-marine-700"
                  : "border-paper-200 text-slate-500"
              }`}
            >
              I&apos;m a {r}
            </button>
          ))}
          {/* Shippers apply through a different form (company info, FMC OTI
              license, Stripe card capture), so this jumps straight there. */}
          <Link
            href="/shipper/signup"
            className="flex h-11 flex-1 items-center justify-center rounded border border-paper-200 text-sm font-medium text-slate-500"
          >
            I&apos;m a shipper
          </Link>
        </fieldset>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-500">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 rounded border border-paper-200 px-3"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-500">Password</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 rounded border border-paper-200 px-3"
          />
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-500">
          <input
            type="checkbox"
            checked={policyAccepted}
            onChange={(e) => setPolicyAccepted(e.target.checked)}
            required
            className="mt-0.5"
          />
          <span>
            I have read and agree to MOVA&rsquo;s{" "}
            <Link
              href={BUYER_PROTECTION_POLICY_PATH}
              target="_blank"
              rel="noopener noreferrer"
              className="text-marine-700 underline underline-offset-2"
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
    </main>
  );
}
