"use client";

import { useState } from "react";
import { buttonClasses } from "@/components/ui/button";

export function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={buttonClasses({ size: "sm" })}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard API can be unavailable (e.g. insecure context) — the
          // link is already shown as plain text right next to this button.
        }
      }}
    >
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}
