"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { acceptPolicies } from "@/app/terms/accept/actions";

export function AcceptPoliciesForm({
  next,
  needsTerms,
  needsPrivacy,
}: {
  next: string | null;
  needsTerms: boolean;
  needsPrivacy: boolean;
}) {
  const [termsAgreed, setTermsAgreed] = useState(!needsTerms);
  const [privacyAgreed, setPrivacyAgreed] = useState(!needsPrivacy);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = (!needsTerms || termsAgreed) && (!needsPrivacy || privacyAgreed);

  async function submit() {
    setPending(true);
    setError(null);
    const res = await acceptPolicies(next);
    // A successful acceptPolicies() redirects server-side and never resolves
    // here — only a failure path returns.
    if (!res.ok) {
      setPending(false);
      setError(res.error);
    }
  }

  return (
    <div className="mt-8 rounded-lg border border-gray-200 bg-white p-5">
      {needsTerms ? (
        <label className="flex items-start gap-2 text-sm text-black">
          <input
            type="checkbox"
            checked={termsAgreed}
            onChange={(e) => setTermsAgreed(e.target.checked)}
            className="mt-0.5"
          />
          <span>I have read and agree to the MOVA Terms &amp; Conditions.</span>
        </label>
      ) : null}

      {needsPrivacy ? (
        <label className={`flex items-start gap-2 text-sm text-black ${needsTerms ? "mt-3" : ""}`}>
          <input
            type="checkbox"
            checked={privacyAgreed}
            onChange={(e) => setPrivacyAgreed(e.target.checked)}
            className="mt-0.5"
          />
          <span>I have read and agree to the MOVA Privacy Policy.</span>
        </label>
      ) : null}

      <p className="mt-3 text-xs text-gray-500">
        By clicking &ldquo;I Agree,&rdquo; you are submitting an electronic
        signature and agreeing to be legally bound by the document(s) above.
      </p>

      <Button
        type="button"
        className="mt-4"
        onClick={submit}
        disabled={!canSubmit || pending}
      >
        {pending ? "Submitting…" : "I Agree"}
      </Button>
      {error ? <p className="mt-2 text-sm text-copper-700">{error}</p> : null}
    </div>
  );
}
