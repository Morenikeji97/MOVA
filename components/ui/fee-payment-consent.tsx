"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BUYER_PROTECTION_POLICY_PATH } from "@/lib/policy";
import { acceptFeePaymentPolicy } from "@/app/buyer/dashboard/actions";

/**
 * Gates the "Pay with Stripe" step behind a brief refund-terms summary and a
 * required "I understand and agree" checkbox. Recording the acceptance
 * (policy_acceptances, context = 'fee_payment') happens on click, before
 * navigating to the pre-built Stripe Checkout URL — so the record exists
 * before the buyer ever reaches Stripe, not after.
 */
export function FeePaymentConsent({
  purchaseRequestId,
  checkoutUrl,
}: {
  purchaseRequestId: string;
  checkoutUrl: string;
}) {
  const [agreed, setAgreed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setPending(true);
    setError(null);
    const res = await acceptFeePaymentPolicy(purchaseRequestId);
    if (!res.ok) {
      setPending(false);
      setError(res.error);
      return;
    }
    window.location.assign(checkoutUrl);
  }

  return (
    <div className="mt-3 rounded border border-paper-200 bg-paper p-3 text-sm text-ink-900">
      <p className="font-medium">Refund terms, in brief</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-slate-500">
        <li>Full refund if you cancel before the seller&rsquo;s contact is revealed.</li>
        <li>
          No refund after contact is revealed — except for seller misrepresentation, a MOVA
          error, or the seller not responding within 5 business days.
        </li>
        <li>
          <Link
            href={BUYER_PROTECTION_POLICY_PATH}
            target="_blank"
            rel="noopener noreferrer"
            className="text-marine-700 underline underline-offset-2"
          >
            Read the full Buyer Protection &amp; Refund Policy
          </Link>
        </li>
      </ul>

      <label className="mt-3 flex items-start gap-2">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5"
        />
        <span>I understand and agree to these terms.</span>
      </label>

      <Button
        type="button"
        size="sm"
        className="mt-3"
        onClick={pay}
        disabled={!agreed || pending}
      >
        {pending ? "Continuing…" : "Pay with Stripe"}
      </Button>
      {error ? <p className="mt-2 text-copper-700">{error}</p> : null}
    </div>
  );
}
