"use client";

import { ActionForm, useActionPending } from "@/components/ui/action-form";

import { type ComponentProps, useState } from "react";
import { Button } from "@/components/ui/button";
import { SERVICE_COUNTRIES, VEHICLE_SIZE_TYPES, SHIPPING_METHODS } from "@/lib/shipping";
import {
  addShippingRate,
  approveShipper,
  deleteShippingRate,
  reinstateShipper,
  rejectShipper,
} from "./actions";
import { inputClasses } from "@/components/ui/input-classes";

const inputClass = inputClasses();

function PendingButton({
  children,
  pendingLabel,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel: string }) {
  const pending = useActionPending();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

export function ShipperReviewActions({ shipperId }: { shipperId: string }) {
  const [rejecting, setRejecting] = useState(false);

  return (
    <div className="mt-4 border-t border-gray-200 pt-4">
      {rejecting ? (
        <ActionForm action={rejectShipper} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={shipperId} />
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500">
              Reason for rejection <span className="text-copper-700">*</span>
            </span>
            <textarea
              name="rejection_reason"
              required
              rows={3}
              placeholder="Tell the applicant what's missing (e.g. FMC OTI license can't be verified)."
              className="rounded border border-gray-200 bg-white px-3 py-2 text-black"
            />
          </label>
          <div className="flex items-center gap-3">
            <PendingButton variant="primary" size="sm" pendingLabel="Rejecting…">
              Confirm rejection
            </PendingButton>
            <button
              type="button"
              onClick={() => setRejecting(false)}
              className="text-sm text-gray-500 hover:text-black"
            >
              Cancel
            </button>
          </div>
        </ActionForm>
      ) : (
        <div className="flex items-center gap-3">
          <ActionForm action={approveShipper}>
            <input type="hidden" name="id" value={shipperId} />
            <PendingButton variant="primary" size="sm" pendingLabel="Approving…">
              Approve
            </PendingButton>
          </ActionForm>
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
    <ActionForm action={reinstateShipper}>
      <input type="hidden" name="id" value={shipperId} />
      <PendingButton variant="primary" size="sm" pendingLabel="Reinstating…">
        Reinstate (good standing)
      </PendingButton>
    </ActionForm>
  );
}

export function DeleteRateButton({ rateId }: { rateId: string }) {
  return (
    <ActionForm action={deleteShippingRate}>
      <input type="hidden" name="id" value={rateId} />
      <PendingButton variant="ghost" size="sm" pendingLabel="Removing…">
        Remove
      </PendingButton>
    </ActionForm>
  );
}

export function AddRateForm({ shipperId }: { shipperId: string }) {
  return (
    <ActionForm
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
      <select name="vehicle_size_type" required defaultValue="" className={inputClass}>
        <option value="" disabled>
          Vehicle size class…
        </option>
        {VEHICLE_SIZE_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <select name="shipping_method" required defaultValue="" className={inputClass}>
        <option value="" disabled>
          Shipping method…
        </option>
        {SHIPPING_METHODS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
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
    </ActionForm>
  );
}
