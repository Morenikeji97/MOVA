"use client";

import { buttonClasses } from "@/components/ui/button";

/**
 * Shares arbitrary text (a referral link, not ShipMova's own contact
 * number — see lib/whatsapp.ts for that one) via WhatsApp's own share
 * intent: no phone number in the URL opens WhatsApp's contact picker
 * instead of a specific chat.
 */
export function WhatsAppShareButton({ text }: { text: string }) {
  const href = `https://wa.me/?text=${encodeURIComponent(text)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClasses({ size: "sm", variant: "secondary" })}
    >
      Share on WhatsApp
    </a>
  );
}
