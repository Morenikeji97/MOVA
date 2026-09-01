"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import type { VerificationStatus } from "@/types/database";
import { startIdentityVerification } from "./actions";

const fmtDate = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

function StartButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Starting…" : label}
    </Button>
  );
}

function StartForm({ label }: { label: string }) {
  return (
    <form action={startIdentityVerification} className="mt-4">
      <StartButton label={label} />
    </form>
  );
}

export function VerificationPanel({
  status,
  verifiedAt,
  notice,
}: {
  status: VerificationStatus | null;
  verifiedAt: string | null;
  notice: "complete" | "error" | null;
}) {
  const s: VerificationStatus = status ?? "unverified";

  return (
    <section className="mt-10 rounded-lg border border-paper-200 bg-paper-100 p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink-900">Identity verification</h2>
        {s === "verified" ? <VerifiedBadge label="Verified" /> : null}
      </div>

      {notice === "complete" && s !== "verified" ? (
        <p className="mt-3 rounded border border-marine-100 bg-marine-50 p-3 text-sm text-marine-700">
          Thanks — you&rsquo;re back from Stripe. This page updates as soon as
          Stripe confirms the result, usually within a minute.
        </p>
      ) : null}
      {notice === "error" ? (
        <p className="mt-3 rounded border border-copper-100 bg-copper-50 p-3 text-sm text-copper-700">
          We couldn&rsquo;t start verification just now. Please try again.
        </p>
      ) : null}

      {s === "verified" ? (
        <p className="mt-3 text-sm text-slate-500">
          Your identity was verified
          {verifiedAt ? ` on ${fmtDate.format(new Date(verifiedAt))}` : ""}. No
          further action needed.
        </p>
      ) : s === "pending" ? (
        <>
          <p className="mt-3 text-sm text-slate-500">
            Verification is in progress. If you didn&rsquo;t finish on Stripe or
            closed the tab, you can pick it back up.
          </p>
          <StartForm label="Resume verification" />
        </>
      ) : s === "failed" ? (
        <>
          <p className="mt-3 text-sm text-copper-700">
            Your last verification didn&rsquo;t pass — this usually means the ID
            photo was unreadable or didn&rsquo;t match. You can try again with a
            clearer photo.
          </p>
          <StartForm label="Try again" />
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-slate-500">
            Verify your identity to list vehicles. You&rsquo;ll be taken to
            Stripe&rsquo;s secure flow to photograph a government ID and take a
            selfie, then returned here.
          </p>
          <StartForm label="Start verification" />
        </>
      )}
    </section>
  );
}
