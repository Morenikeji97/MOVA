"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

// Supabase's resetPasswordForEmail is enumeration-safe by design — it
// resolves the same way whether or not the address has an account — so this
// never branches on { error } for the existence question. The one exception
// is a rate-limit response: that's an infra signal, not an answer about the
// account, and hiding it would just leave someone stuck re-submitting into a
// wall with no explanation.
function isRateLimitError(message: string) {
  return /rate limit/i.test(message);
}

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setLoading(false);

    if (error && isRateLimitError(error.message)) {
      setError("Too many requests — please wait a few minutes and try again.");
      return;
    }

    // Same screen whether or not the email is registered.
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
        <h1 className="text-2xl font-semibold text-ink-900">Check your email</h1>
        <p className="mt-2 text-slate-500">
          If an account exists for {email}, we&rsquo;ve sent a link to reset
          its password. The link expires shortly and can only be used once.
        </p>
        <Link href="/login" className="mt-6 text-sm text-marine-700 hover:underline">
          Back to sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="mb-2 text-2xl font-semibold text-ink-900">Reset your password</h1>
      <p className="mb-6 text-sm text-slate-500">
        Enter the email on your MOVA account and we&rsquo;ll send you a link
        to set a new password. This works the same way for buyers, sellers,
        shippers, and admins — they all sign in with the same email + password.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-500">Email</span>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 rounded border border-paper-200 px-3"
          />
        </label>
        {error && <p className="text-sm text-copper-700">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? "Sending…" : "Send reset link"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        <Link href="/login" className="text-marine-700 hover:underline">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
