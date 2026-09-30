"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * "Send me a new confirmation email" for an expired signup link. Same
 * message whether or not the address is registered, so it can't be used to
 * check who has an account.
 */
export function ResendConfirmation({ className }: { className?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      // The email link is built from this ({{ .RedirectTo }}), so it
      // brings the user back to this same site.
      options: { emailRedirectTo: window.location.origin },
    });
    setState(error && /rate|too many/i.test(error.message) ? "error" : "sent");
  }

  if (state === "sent") {
    return (
      <p className={cn("rounded border border-verified-100 bg-verified-50 p-3 text-sm text-verified-600", className)}>
        If that email needs confirming, a new link is on its way.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className={cn("flex flex-col gap-2", className)}>
      <label className="flex flex-col gap-1 text-sm text-gray-500">
        Need a new confirmation email?
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          className="h-11 rounded border border-gray-200 px-3 text-black"
        />
      </label>
      {state === "error" ? (
        <p role="alert" className="text-sm text-copper-700">
          Too many requests — please wait a few minutes and try again.
        </p>
      ) : null}
      <Button type="submit" variant="secondary" disabled={state === "sending"} className="self-start">
        {state === "sending" ? "Sending…" : "Send a new link"}
      </Button>
    </form>
  );
}
