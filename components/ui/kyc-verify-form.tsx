"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { verifyBuyerIdentity } from "@/app/buyer/kyc/actions";

const LABEL: Record<"nin" | "bvn", string> = {
  nin: "NIN",
  bvn: "BVN",
};

export function KycVerifyForm({ kind }: { kind: "nin" | "bvn" }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [failed, setFailed] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setFailed(false);
    const res = await verifyBuyerIdentity(kind, formData);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.verified) {
      setVerified(true);
    } else {
      setFailed(true);
    }
  }

  if (verified) {
    return (
      <p className="text-sm text-verified-600">
        {LABEL[kind]} verified.
      </p>
    );
  }

  return (
    <form action={onSubmit} className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        name="value"
        inputMode="numeric"
        pattern="[0-9]{11}"
        maxLength={11}
        placeholder={`11-digit ${LABEL[kind]}`}
        className="w-44 rounded border border-gray-300 px-2 py-1 font-mono text-sm"
        disabled={pending}
        required
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Checking\u2026" : `Verify ${LABEL[kind]}`}
      </Button>
      {failed ? (
        <span className="text-sm text-copper-700">
          That {LABEL[kind]} didn&rsquo;t match \u2014 double-check it, or try your{" "}
          {kind === "nin" ? "BVN" : "NIN"} instead.
        </span>
      ) : null}
      {error ? <span className="text-sm text-copper-700">{error}</span> : null}
    </form>
  );
}
