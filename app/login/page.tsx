"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
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

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="mb-6 text-2xl font-semibold text-ink-900">Sign in to MOVA</h1>
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
          <span className="text-sm text-slate-500">Password</span>
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
    </main>
  );
}
