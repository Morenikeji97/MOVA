"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { claimShipper, startShipperCardSetup } from "./actions";

function Pending({
  idle,
  busy,
  variant = "primary",
}: {
  idle: string;
  busy: string;
  variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size="sm" disabled={pending}>
      {pending ? busy : idle}
    </Button>
  );
}

export function ClaimButton() {
  return (
    <form action={claimShipper}>
      <Pending idle="Link this account" busy="Linking…" />
    </form>
  );
}

export function UpdateCardButton({ hasCard }: { hasCard: boolean }) {
  return (
    <form action={startShipperCardSetup}>
      <Pending
        idle={hasCard ? "Update card on file" : "Add a card"}
        busy="Opening Stripe…"
        variant="secondary"
      />
    </form>
  );
}
