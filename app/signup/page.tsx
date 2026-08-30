"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/types/database";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("buyer");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role },
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
        {error && <p className="text-sm text-copper-700">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </main>
  );
}
