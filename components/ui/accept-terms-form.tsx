"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { acceptTerms } from "@/app/terms/accept/actions";

export function AcceptTermsForm({ next }: { next: string | null }) {
  const [agreed, setAgreed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    const res = await acceptTerms(next);
    // A successful acceptTerms() redirects server-side and never resolves
    // here — only a failure path returns.
    if (!res.ok) {
      setPending(false);
      setError(res.error);
    }
  }

  return (
    <div className="mt-8 rounded-lg border border-gray-200 bg-white p-5">
      <label className="flex items-start gap-2 text-sm text-black">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5"
        />
        <span>I have read and agree to the MOVA Terms &amp; Conditions.</span>
      </label>

      <p className="mt-3 text-xs text-gray-500">
        By clicking &ldquo;I Agree,&rdquo; you are submitting an electronic
        signature and agreeing to be legally bound by these Terms &amp;
        Conditions.
      </p>

      <Button
        type="button"
        className="mt-4"
        onClick={submit}
        disabled={!agreed || pending}
      >
        {pending ? "Submitting…" : "I Agree"}
      </Button>
      {error ? <p className="mt-2 text-sm text-copper-700">{error}</p> : null}
    </div>
  );
}
