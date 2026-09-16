"use client";

import { useFormStatus } from "react-dom";
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
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="shippingStatus"
      value={value}
      disabled={active || pending}
      aria-pressed={active}
      className={cn(
        "h-11 flex-1 min-w-[7.5rem] rounded border text-sm font-medium transition-colors disabled:opacity-100",
        active
          ? "border-marine bg-marine text-white"
          : "border-paper-200 bg-paper-100 text-ink-900 hover:border-marine-400",
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
    <form action={updateShippingStatus} className="flex flex-wrap gap-2">
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
    </form>
  );
}
