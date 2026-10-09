"use client";

import { ActionForm, useActionPending } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input-classes";
import { decideShipperCoi, recordShipperLicenseCheck } from "./actions";

function Submit({ label, name, value, variant }: { label: string; name: string; value: string; variant?: "secondary" }) {
  const pending = useActionPending();
  return (
    <Button type="submit" name={name} value={value} variant={variant} disabled={pending} className="w-full sm:w-auto">
      {pending ? "Saving…" : label}
    </Button>
  );
}

/** Approve or reject a pending insurance certificate. */
export function CoiDecisionForm({ shipperId }: { shipperId: string }) {
  return (
    <ActionForm action={decideShipperCoi} className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="id" value={shipperId} />
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">Reason, if rejecting (the shipper sees this)</span>
        <input name="note" maxLength={1000} autoComplete="off" className={inputClasses()} />
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Submit label="Approve certificate" name="decision" value="approve" />
        <Submit label="Reject certificate" name="decision" value="reject" variant="secondary" />
      </div>
    </ActionForm>
  );
}

/** Record what the FMC's OTI list says about this license. */
export function LicenseCheckForm({ shipperId }: { shipperId: string }) {
  return (
    <ActionForm action={recordShipperLicenseCheck} className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="id" value={shipperId} />
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">Note (optional, e.g. the name listed)</span>
        <input name="note" maxLength={1000} autoComplete="off" className={inputClasses()} />
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Submit label="Found — active on FMC list" name="result" value="active" />
        <Submit label="Not found" name="result" value="not_found" variant="secondary" />
      </div>
    </ActionForm>
  );
}
