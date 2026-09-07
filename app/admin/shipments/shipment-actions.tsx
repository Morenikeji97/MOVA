"use client";

import { type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { completeShipment } from "./actions";

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

export function CompleteShipmentButton({
  shipmentId,
}: {
  shipmentId: string;
}) {
  return (
    <form action={completeShipment}>
      <input type="hidden" name="id" value={shipmentId} />
      <PendingButton
        variant="primary"
        size="sm"
        pendingLabel="Completing & charging…"
      >
        Mark completed &amp; charge commission
      </PendingButton>
    </form>
  );
}
