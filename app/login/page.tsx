"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { checkLoginRateLimit } from "./actions";

function LoginForm() {
  const router = useRouter();
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

    router.push(searchParams.get("next") ?? "/");
    router.refresh();
  }

  const authError = searchParams.get("error");
  const resetNotice = searchParams.get("reset");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="mb-6 text-2xl font-semibold text-ink-900">Sign in to MOVA</h1>

      {resetNotice === "success" ? (
        <p className="mb-4 rounded border border-verified-100 bg-verified-50 p-3 text-sm text-verified-600">
          Password updated. Sign in with your new password.
        </p>
      ) : null}
      {authError === "verification_failed" ? (
        <p className="mb-4 rounded border border-copper-100 bg-copper-50 p-3 text-sm text-copper-700">
          That link is invalid or has expired. Please try again.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-slate-500">Password</span>
            <Link
              href={email ? `/forgot-password?email=${encodeURIComponent(email)}` : "/forgot-password"}
              className="text-sm text-marine-700 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 rounded border border-paper-200 px-3"
          />
        </label>
        {error && <p className="text-sm text-copper-700">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {/* MOVA has no separate username — the email above is it, for every
          account type (buyer, seller, shipper, admin). So there's nothing
          to build here beyond this note: if you can't remember which email
          you signed up with, there's no separate identity to recover. */}
      <p className="mt-3 text-center text-xs text-ink-400">
        Your email is your MOVA username — there&rsquo;s no separate login name.
      </p>

      <p className="mt-6 text-center text-sm text-slate-500">
        Shipping company?{" "}
        <Link href="/shipper" className="text-marine-700 hover:underline">
          Shipper portal
        </Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
