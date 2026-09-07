"use client";

import { type ComponentProps, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { SERVICE_COUNTRIES } from "@/lib/shipping";
import {
  addShippingRate,
  approveShipper,
  deleteShippingRate,
  reinstateShipper,
  rejectShipper,
} from "./actions";

const inputClass =
  "h-10 rounded border border-paper-200 bg-paper-100 px-3 text-sm text-ink-900";

function PendingButton({
  children,
  pendingLabel,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

export function ShipperReviewActions({ shipperId }: { shipperId: string }) {
  const [rejecting, setRejecting] = useState(false);

  return (
    <div className="mt-4 border-t border-paper-200 pt-4">
      {rejecting ? (
        <form action={rejectShipper} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={shipperId} />
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-500">
              Reason for rejection <span className="text-copper-700">*</span>
            </span>
            <textarea
              name="rejection_reason"
              required
              rows={3}
              placeholder="Tell the applicant what's missing (e.g. FMC OTI license can't be verified)."
              className="rounded border border-paper-200 bg-paper-100 px-3 py-2 text-ink-900"
            />
          </label>
          <div className="flex items-center gap-3">
            <PendingButton variant="primary" size="sm" pendingLabel="Rejecting…">
              Confirm rejection
            </PendingButton>
            <button
              type="button"
              onClick={() => setRejecting(false)}
              className="text-sm text-slate-500 hover:text-ink-900"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-3">
          <form action={approveShipper}>
            <input type="hidden" name="id" value={shipperId} />
            <PendingButton variant="primary" size="sm" pendingLabel="Approving…">
              Approve
            </PendingButton>
          </form>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setRejecting(true)}
          >
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}

export function ReinstateShipperButton({ shipperId }: { shipperId: string }) {
  return (
    <form action={reinstateShipper}>
      <input type="hidden" name="id" value={shipperId} />
      <PendingButton variant="primary" size="sm" pendingLabel="Reinstating…">
        Reinstate (good standing)
      </PendingButton>
    </form>
  );
}

export function DeleteRateButton({ rateId }: { rateId: string }) {
  return (
    <form action={deleteShippingRate}>
      <input type="hidden" name="id" value={rateId} />
      <PendingButton variant="ghost" size="sm" pendingLabel="Removing…">
        Remove
      </PendingButton>
    </form>
  );
}

export function AddRateForm({ shipperId }: { shipperId: string }) {
  return (
    <form
      action={addShippingRate}
      className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"
    >
      <input type="hidden" name="shipper_id" value={shipperId} />
      <input
        name="origin_region"
        required
        placeholder="Origin region (e.g. US East Coast)"
        className={inputClass}
      />
      <input
        name="origin_port"
        placeholder="Origin port (optional)"
        className={inputClass}
      />
      <select name="destination_country" required defaultValue="" className={inputClass}>
        <option value="" disabled>
          Destination country…
        </option>
        {SERVICE_COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
      <input
        name="vehicle_size_type"
        placeholder="Vehicle size / type (optional)"
        className={inputClass}
      />
      <input
        name="price"
        type="number"
        min={0}
        step="0.01"
        required
        placeholder="Price"
        className={inputClass}
      />
      <input
        name="currency"
        defaultValue="USD"
        maxLength={3}
        className={inputClass}
      />
      <div className="sm:col-span-2">
        <PendingButton variant="secondary" size="sm" pendingLabel="Adding…">
          Add rate
        </PendingButton>
      </div>
    </form>
  );
}
