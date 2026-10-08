"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/ui/auth-shell";
import { inputClasses } from "@/components/ui/input-classes";

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
      // The reset email links to {{ .RedirectTo }}/auth/confirm?…&type=recovery
      // (supabase/email-templates/recovery.html), which lands on /reset-password.
      redirectTo: window.location.origin,
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
      <AuthShell center>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Check your email</h1>
        <p className="mt-2 text-muted">
          If an account exists for {email}, we&rsquo;ve sent a link to reset
          its password. The link expires shortly and can only be used once.
        </p>
        <Link href="/login" className="mt-6 text-sm font-semibold text-ink hover:underline">
          Back to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="mb-2 font-display text-2xl font-extrabold tracking-tight text-ink">Reset your password</h1>
      <p className="mb-6 text-sm text-muted">
        Enter the email on your ShipMova account and we&rsquo;ll send you a link
        to set a new password. This works the same way for buyers, sellers,
        shippers, and admins — they all sign in with the same email + password.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClasses()}
          />
        </label>
        {error && <p className="text-sm text-copper-700">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? "Sending…" : "Send reset link"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="text-ink hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
