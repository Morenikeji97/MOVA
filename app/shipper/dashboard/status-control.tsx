"use client";

import { ActionForm, useActionPending } from "@/components/ui/action-form";

import { updateShippingStatus } from "./actions";
import type { ShipmentShippingStatus } from "@/types/database";
import { cn } from "@/lib/utils";

const STEPS: { value: ShipmentShippingStatus; label: string }[] = [
  { value: "awaiting_pickup", label: "Awaiting pickup" },
  { value: "picked_up", label: "Picked up" },
  { value: "in_transit", label: "In transit" },
  { value: "delivered", label: "Delivered" },
];

function StatusButton({
  shipmentId,
  value,
  label,
  active,
}: {
  shipmentId: string;
  value: ShipmentShippingStatus;
  label: string;
  active: boolean;
}) {
  const pending = useActionPending();
  return (
    <button
      type="submit"
      name="shippingStatus"
      value={value}
      disabled={active || pending}
      aria-pressed={active}
      className={cn(
        "h-11 w-full rounded-lg border px-2 text-sm font-semibold transition-colors disabled:opacity-100",
        active
          ? "border-ink bg-ink text-white"
          : "border-line bg-white text-ink hover:border-ink",
        pending && !active && "opacity-50",
      )}
    >
      {label}
    </button>
  );
}

/** One tap changes the shipper-owned logistics status — no confirmation
 * step, no dropdown menu. Every button submits the same form; only the
 * `shippingStatus` value differs per button (native form semantics, no
 * client state needed). */
export function ShippingStatusControl({
  shipmentId,
  current,
}: {
  shipmentId: string;
  current: ShipmentShippingStatus;
}) {
  return (
    // Two per row on phones (each a half-width tap target), one row from sm.
    <ActionForm action={updateShippingStatus} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <input type="hidden" name="shipmentId" value={shipmentId} />
      {STEPS.map((step) => (
        <StatusButton
          key={step.value}
          shipmentId={shipmentId}
          value={step.value}
          label={step.label}
          active={step.value === current}
        />
      ))}
    </ActionForm>
  );
}
