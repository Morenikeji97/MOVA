"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/ui/auth-shell";
import { inputClasses } from "@/components/ui/input-classes";
import { checkLoginRateLimit } from "./actions";

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const rateLimit = await checkLoginRateLimit(email);
    if (!rateLimit.ok) {
      setError(rateLimit.error ?? "Please try again shortly.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // /auth/landing picks the destination: a shipper's own portal, else
    // `next` or the home page (lib/account-kind.ts).
    const next = searchParams.get("next");
    // A full page load (not router.push): /auth/landing is a route handler
    // that answers with a redirect, and every server component should
    // render signed-in.
    window.location.assign(next ? `/auth/landing?next=${encodeURIComponent(next)}` : "/auth/landing");
  }

  const authError = searchParams.get("error");
  const resetNotice = searchParams.get("reset");

  return (
    <AuthShell>
      <h1 className="mb-6 font-display text-2xl font-extrabold tracking-tight text-ink">Sign in to ShipMova</h1>

      {resetNotice === "success" ? (
        <p className="mb-4 rounded-lg border border-verified-100 bg-verified-50 p-3 text-sm text-verified-600">
          Password updated. Sign in with your new password.
        </p>
      ) : null}
      {authError === "verification_failed" ? (
        <p className="mb-4 rounded-lg border border-copper-100 bg-copper-50 p-3 text-sm text-copper-700">
          That link is invalid or has expired. Please try again.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted">Password</span>
            <Link
              href={email ? `/forgot-password?email=${encodeURIComponent(email)}` : "/forgot-password"}
              className="text-sm font-semibold text-ink hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClasses()}
          />
        </label>
        {error && <p className="text-sm text-copper-700">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {/* ShipMova has no separate username — the email above is it, for every
          account type (buyer, seller, shipper, admin). So there's nothing
          to build here beyond this note: if you can't remember which email
          you signed up with, there's no separate identity to recover. */}
      <p className="mt-3 text-center text-xs text-muted">
        Your email is your ShipMova username — there&rsquo;s no separate login name.
      </p>

      <p className="mt-6 text-center text-sm text-muted">
        Shipping company?{" "}
        <Link href="/shipper" className="inline-flex h-11 items-center font-semibold text-ink hover:underline">
          Shipper portal
        </Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
