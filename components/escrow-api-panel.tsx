"use client";

import { ActionForm, useActionPending } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";

type Action = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

function Submit({ label }: { label: string }) {
  const pending = useActionPending();
  return (
    <Button type="submit" variant="secondary" size="sm" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Working…" : label}
    </Button>
  );
}

/**
 * Admin panel for one Escrow.com transaction (car or shipping): its state
 * as last fetched, the buyer's Escrow.com fee, and open / refresh buttons.
 * Without Escrow.com credentials it says so; staff use the manual form.
 */
export function EscrowApiPanel({
  title,
  configured,
  targetId,
  transactionId,
  lines,
  feeUsd,
  syncedAt,
  openAction,
  openLabel,
  refreshAction,
  blockedReason,
}: {
  title: string;
  configured: boolean;
  targetId: string;
  transactionId: string | null;
  lines: { label: string; value: string }[];
  feeUsd: number | null;
  syncedAt: string | null;
  openAction: Action;
  openLabel: string;
  refreshAction: Action;
  /** Why it can't be opened yet, if so. */
  blockedReason?: string | null;
}) {
  return (
    <div className="mt-4 border-t border-gray-200 pt-4">
      <p className="font-mono text-xs uppercase tracking-wider text-gray-500">{title}</p>
      {!configured ? (
        <p className="mt-1 text-sm text-gray-500">Escrow.com isn&rsquo;t connected yet — use the reference form.</p>
      ) : transactionId ? (
        <>
          <dl className="mt-2 grid grid-cols-1 gap-1 text-sm">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-gray-500">Escrow.com transaction</dt>
              <dd className="font-mono text-black">{transactionId}</dd>
            </div>
            {lines.map((l) => (
              <div key={l.label} className="flex flex-wrap gap-x-2">
                <dt className="text-gray-500">{l.label}</dt>
                <dd className="text-black">{l.value}</dd>
              </div>
            ))}
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-gray-500">Escrow.com fee (buyer pays)</dt>
              <dd className="text-black">{feeUsd != null ? `$${feeUsd.toFixed(2)}` : "not reported yet"}</dd>
            </div>
            {syncedAt ? (
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-gray-500">Last checked</dt>
                <dd className="text-black">{new Date(syncedAt).toUTCString().slice(5, 22)} UTC</dd>
              </div>
            ) : null}
          </dl>
          <ActionForm action={refreshAction} className="mt-3">
            <input type="hidden" name="transaction_id" value={transactionId} />
            <Submit label="Refresh from Escrow.com" />
          </ActionForm>
        </>
      ) : blockedReason ? (
        <p className="mt-1 text-sm text-gray-500">{blockedReason}</p>
      ) : (
        <ActionForm action={openAction} className="mt-2">
          <input type="hidden" name="id" value={targetId} />
          <Submit label={openLabel} />
        </ActionForm>
      )}
    </div>
  );
}
