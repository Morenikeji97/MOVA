"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { FeePaymentConsent } from "./fee-payment-consent";
import { BankTransferPayment } from "./bank-transfer-payment";
import type { BankTransferDetails } from "@/lib/bank-transfer";

type Method = "card" | "bank";

function Tab({
  active,
  disabled,
  onClick,
  children,
  title,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "rounded px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-marine-700 text-white"
          : "bg-paper-100 text-slate-500 hover:text-ink-900",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Lets the buyer choose between the two ways to pay MOVA's service fee:
 * card (FeePaymentConsent → Stripe Checkout, unchanged) or bank transfer
 * (BankTransferPayment). Bank transfer is disabled — not hidden — when
 * bankDetails is null (an env var is missing), so the buyer isn't left
 * wondering why an option vanished.
 */
export function FeePaymentOptions({
  purchaseRequestId,
  checkoutUrl,
  buyerFeeUsd,
  bankDetails,
  referenceCode,
}: {
  purchaseRequestId: string;
  checkoutUrl: string;
  buyerFeeUsd: number | null;
  bankDetails: BankTransferDetails | null;
  referenceCode: string;
}) {
  const [method, setMethod] = useState<Method>("card");

  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <Tab active={method === "card"} onClick={() => setMethod("card")}>
          Pay with card
        </Tab>
        <Tab
          active={method === "bank"}
          disabled={!bankDetails}
          onClick={() => setMethod("bank")}
          title={bankDetails ? undefined : "Bank transfer isn't set up yet."}
        >
          Pay by bank transfer
        </Tab>
      </div>

      {method === "card" ? (
        <FeePaymentConsent purchaseRequestId={purchaseRequestId} checkoutUrl={checkoutUrl} />
      ) : bankDetails ? (
        <BankTransferPayment
          purchaseRequestId={purchaseRequestId}
          buyerFeeUsd={buyerFeeUsd}
          bankDetails={bankDetails}
          referenceCode={referenceCode}
        />
      ) : null}
    </div>
  );
}
