"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { BankTransferDetails } from "@/lib/bank-transfer";
import { submitBankTransferProof } from "@/app/buyer/dashboard/actions";

const BUCKET = "bank-transfer-proofs";
const ACCEPT = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
const MAX_BYTES = 10 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

const usdCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-xs uppercase tracking-wider text-ink-400">{label}</dt>
      <dd className="text-ink-900">{value}</dd>
    </div>
  );
}

/**
 * Bank-transfer fallback for the buyer's MOVA service fee, alongside
 * FeePaymentConsent (card). Two steps in one panel: view MOVA's wire
 * details + this reservation's reference code, then upload proof of the
 * transfer.
 *
 * Uploading writes straight to the private bank-transfer-proofs bucket with
 * the buyer's own session (storage RLS: migration 0014) at
 * <uid>/<purchase_request_id>/<uuid>.<ext>, then submitBankTransferProof
 * records it on the reservation. That server action only ever moves
 * mova_fee_payment_status to 'pending_manual_verification' — it can't reach
 * 'paid' here or anywhere else on the buyer's side; only an admin
 * confirming in /admin/reservations does that.
 */
export function BankTransferPayment({
  purchaseRequestId,
  buyerFeeUsd,
  bankDetails,
  referenceCode,
}: {
  purchaseRequestId: string;
  buyerFeeUsd: number | null;
  bankDetails: BankTransferDetails;
  referenceCode: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function upload(file: File) {
    setError(null);

    if (!ACCEPT.includes(file.type as (typeof ACCEPT)[number])) {
      setError(`${file.name}: unsupported format — use JPEG, PNG, WebP, or PDF.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`${file.name}: larger than 10 MB.`);
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Your session has expired. Please sign in again.");
        return;
      }

      const path = `${user.id}/${purchaseRequestId}/${crypto.randomUUID()}.${EXT[file.type]}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });
      if (upErr) {
        setError(`Couldn't upload: ${upErr.message}`);
        return;
      }

      const res = await submitBankTransferProof(purchaseRequestId, path);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="mt-3 rounded border border-verified-100 bg-verified-50 p-3 text-sm text-verified-600">
        Transfer proof submitted — MOVA will confirm it shortly.
      </p>
    );
  }

  return (
    <div className="mt-3 rounded border border-paper-200 bg-paper p-3 text-sm text-ink-900">
      <p className="font-medium">Wire the fee to MOVA</p>
      <dl className="mt-2 grid grid-cols-1 gap-y-2 sm:grid-cols-2 sm:gap-x-4">
        <Field label="Bank" value={bankDetails.name} />
        <Field label="Address" value={bankDetails.address} />
        <Field label="SWIFT / BIC" value={bankDetails.swift} />
        <Field label="Account number" value={bankDetails.accountNumber} />
        <Field label="Routing number" value={bankDetails.routingNumber} />
        <Field
          label="Amount"
          value={buyerFeeUsd != null ? usdCents.format(buyerFeeUsd) : "—"}
        />
      </dl>
      <div className="mt-3 rounded border border-marine-100 bg-marine-50 p-2.5">
        <p className="font-mono text-xs uppercase tracking-wider text-marine-700">
          Reference — include this in your transfer memo
        </p>
        <p className="font-mono text-lg font-semibold text-marine-700">{referenceCode}</p>
      </div>
      <p className="mt-3 text-slate-500">
        After you&rsquo;ve sent the transfer, upload a screenshot or photo of
        the confirmation. MOVA will verify it and unlock the seller&rsquo;s
        contact details once received — this can take a little longer than
        an instant card payment.
      </p>

      <label className="mt-3 flex flex-col gap-2">
        <span className="text-sm font-medium">Upload transfer confirmation</span>
        <input
          type="file"
          accept={ACCEPT.join(",")}
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
          className="text-sm text-slate-500 file:mr-3 file:rounded file:border-0 file:bg-marine-700 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
        />
      </label>

      {busy ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Uploading…
        </p>
      ) : null}
      {error ? <p className="mt-2 text-copper-700">{error}</p> : null}
    </div>
  );
}
