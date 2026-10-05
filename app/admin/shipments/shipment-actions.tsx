"use client";

import { ActionForm, useActionPending } from "@/components/ui/action-form";

import { type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { completeShipment } from "./actions";
import { SHIPPER_FEES_ENABLED } from "@/lib/shipping";

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

export function CompleteShipmentButton({
  shipmentId,
}: {
  shipmentId: string;
}) {
  return (
    <ActionForm action={completeShipment}>
      <input type="hidden" name="id" value={shipmentId} />
      <PendingButton
        variant="primary"
        pendingLabel={SHIPPER_FEES_ENABLED ? "Completing & charging…" : "Completing…"}
      >
        {SHIPPER_FEES_ENABLED ? "Mark completed & charge commission" : "Mark completed"}
      </PendingButton>
    </ActionForm>
  );
}
