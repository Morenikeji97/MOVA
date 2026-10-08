"use client";

import { ActionForm, useActionPending } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input-classes";
import {
  assignInspectorAction,
  decideInspectionAction,
  decideInspectorApplication,
  markInspectorPaidAction,
} from "./actions";

function Submit({ label, name, value, variant }: { label: string; name?: string; value?: string; variant?: "secondary" }) {
  const pending = useActionPending();
  return (
    <Button type="submit" name={name} value={value} variant={variant} disabled={pending} className="w-full sm:w-auto">
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function AssignInspectorForm({ purchaseRequestId }: { purchaseRequestId: string }) {
  return (
    <ActionForm action={assignInspectorAction} className="mt-2">
      <input type="hidden" name="id" value={purchaseRequestId} />
      <Submit label="Assign an inspector at random" variant="secondary" />
    </ActionForm>
  );
}

export function InspectorApplicationForm({ inspectorId, approved }: { inspectorId: string; approved: boolean }) {
  return (
    <ActionForm action={decideInspectorApplication} className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="id" value={inspectorId} />
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">Reason (needed to reject or suspend; the inspector sees it)</span>
        <input name="reason" maxLength={1000} autoComplete="off" className={inputClasses()} />
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        {approved ? (
          <Submit label="Suspend" name="decision" value="suspend" variant="secondary" />
        ) : (
          <>
            <Submit label="Approve inspector" name="decision" value="approve" />
            <Submit label="Reject" name="decision" value="reject" variant="secondary" />
          </>
        )}
      </div>
    </ActionForm>
  );
}

export function DecideInspectionForm({ inspectionId }: { inspectionId: string }) {
  return (
    <ActionForm action={decideInspectionAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={inspectionId} />
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">Note (needed to fail)</span>
        <input name="note" maxLength={1000} autoComplete="off" className={inputClasses()} />
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Submit label="Pass inspection" name="decision" value="pass" />
        <Submit label="Fail inspection" name="decision" value="fail" variant="secondary" />
      </div>
    </ActionForm>
  );
}

export function MarkPaidForm({ inspectionId }: { inspectionId: string }) {
  return (
    <ActionForm action={markInspectorPaidAction}>
      <input type="hidden" name="id" value={inspectionId} />
      <Submit label="Mark inspector paid" variant="secondary" />
    </ActionForm>
  );
}
