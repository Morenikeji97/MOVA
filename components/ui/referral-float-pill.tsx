"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "@/components/ui/use-account";
import { GiftIcon, CloseIcon } from "@/components/ui/icons";
import { REFERRAL_PAYOUT_AMOUNT_USD } from "@/lib/referrals";
import { cn } from "@/lib/utils";

const DISMISSED_KEY = "shipmova:referral-pill-dismissed";

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function saveDismissed() {
  try {
    window.localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // Private mode / blocked storage: it just won't be remembered.
  }
}

/**
 * Persistent floating "Earn $1,000" pill, mounted once in app/layout.tsx so
 * it follows a signed-out visitor across every public page (founder,
 * 2026-10-15: the homepage's referral section exists but is easy to miss on
 * a phone — see the section's own comment in app/page.tsx for why).
 *
 * Opposite corner from the WhatsApp button (components/ui/whatsapp-button.tsx,
 * bottom-right) so the two never collide. `/#refer` both scrolls to the
 * homepage section (Next.js's own same-page hash scroll) and, from any other
 * page, navigates there then scrolls — one href covers both cases.
 *
 * Dismiss is a separate sibling button (not nested inside the link) and
 * remembered in localStorage so closing it once keeps it closed on later
 * visits.
 */
export function ReferralFloatPill() {
  const account = useAccount();
  const [dismissed, setDismissed] = useState(true); // nothing flashes before hydration decides

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  const signedOut = account.ready && !account.email;
  if (!signedOut || dismissed) return null;

  return (
    <div className="referral-float fixed bottom-4 left-4 z-50 sm:bottom-6 sm:left-6 print:hidden">
      <div className="relative">
        <Link
          href="/#refer"
          className={cn(
            "flex h-12 items-center gap-2 rounded-full bg-ink pl-4 pr-5 text-sm font-bold text-white shadow-lg shadow-black/25",
            "hover:bg-ink/90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2",
          )}
        >
          <GiftIcon size={18} />
          Earn ${REFERRAL_PAYOUT_AMOUNT_USD.toLocaleString()}
        </Link>
        <button
          type="button"
          onClick={() => {
            saveDismissed();
            setDismissed(true);
          }}
          aria-label="Dismiss"
          // Visually a small circle (as asked), but the actual tap target is
          // widened to 44px with an invisible pseudo-element so it still
          // meets the mobile tap-target minimum.
          className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-white text-ink shadow before:absolute before:-inset-2 before:content-['']"
        >
          <CloseIcon size={14} />
        </button>
      </div>
    </div>
  );
}
