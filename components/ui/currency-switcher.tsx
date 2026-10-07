"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import {
  DISPLAY_CURRENCIES,
  DISPLAY_CURRENCY_COOKIE,
  parseDisplayCurrency,
  type DisplayCurrency,
} from "@/lib/display-currency";
import { ChevronDownIcon } from "@/components/ui/icons";

/**
 * Header currency switcher (lib/display-currency.ts). Display only — prices
 * are always charged in USD; this picks the local equivalent shown beside
 * them. Saved in a cookie on this device, then the page re-renders.
 */
export function CurrencySwitcher({
  value,
  tone = "dark",
  className,
}: {
  value: DisplayCurrency;
  /** "dark" on the black header, "light" inside a white panel. */
  tone?: "dark" | "light";
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(raw: string) {
    const code = parseDisplayCurrency(raw);
    if (!code) return;
    document.cookie = `${DISPLAY_CURRENCY_COOKIE}=${code}; Path=/; Max-Age=31536000; SameSite=Lax`;
    startTransition(() => router.refresh());
  }

  return (
    <label className={cn("relative inline-flex items-center", className)}>
      <span className="sr-only">Show prices in</span>
      <select
        value={value}
        onChange={(e) => choose(e.target.value)}
        disabled={pending}
        className={cn(
          "h-11 cursor-pointer appearance-none rounded-lg border pl-3 pr-8 text-base font-medium disabled:opacity-60",
          tone === "dark"
            ? "border-white/25 bg-ink text-white hover:border-white/60"
            : "border-line bg-white text-ink hover:border-ink",
        )}
      >
        {DISPLAY_CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon size={16} className="pointer-events-none absolute right-2.5" />
    </label>
  );
}
