"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type LinkStatus = "checking" | "ready" | "expired";

/**
 * Landed on from the reset-password email link, via
 * /auth/callback?next=/reset-password — that route already exchanged the
 * recovery code for a session (same exchangeCodeForSession the signup
 * email-confirmation link uses), so by the time this page renders there
 * should be an authenticated session sitting in cookies. If there isn't
 * (the link was already used, expired, or someone landed here directly),
 * say so and send them back to request a new one, rather than showing a
 * form that would just fail.
 *
 * Works identically for every account type (buyer/seller/admin, and a
 * shipper's linked account) — there's no per-role branching here because
 * there's no per-role auth; they all sit in the same auth.users table.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<LinkStatus>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setStatus(user ? "ready" : "expired");
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    // Close out the recovery session rather than leaving the browser signed
    // in — the link may well have been opened from an email client on a
    // shared or public device. Send them to sign in fresh instead.
    await supabase.auth.signOut();
    router.push("/login?reset=success");
  }

  if (status === "checking") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
        <p className="text-slate-500">Checking your link…</p>
      </main>
    );
  }

  if (status === "expired") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
        <h1 className="text-2xl font-semibold text-ink-900">Link expired</h1>
        <p className="mt-2 text-slate-500">
          This password reset link is invalid, already used, or has expired.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 text-sm text-marine-700 hover:underline"
        >
          Request a new link
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="mb-6 text-2xl font-semibold text-ink-900">Set a new password</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-500">New password</span>
          <input
            type="password"
            required
            minLength={8}
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 rounded border border-paper-200 px-3"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-500">Confirm new password</span>
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="h-11 rounded border border-paper-200 px-3"
          />
        </label>
        {error && <p className="text-sm text-copper-700">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? "Updating…" : "Update password"}
        </Button>
      </form>
    </main>
  );
}
