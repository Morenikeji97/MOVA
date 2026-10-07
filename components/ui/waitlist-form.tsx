"use client";

import { useActionState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { inputClasses } from "@/components/ui/input-classes";
import {
  WAITLIST_COUNTRIES,
  type WaitlistAudience,
  type WaitlistSource,
} from "@/lib/prelaunch";
import { joinWaitlist } from "@/app/waitlist/actions";

/** This form is for buyers and sellers; partners use PartnerWaitlistForm. */
type BuyerOrSeller = Extract<WaitlistAudience, "buyer" | "seller">;

const COPY: Record<BuyerOrSeller, { heading: string; intro: string; success: string }> = {
  buyer: {
    heading: "Join the waitlist",
    intro:
      "ShipMova isn't taking reservations or payments yet. Leave an email or WhatsApp number and we'll tell you the moment we launch.",
    success: "We'll message you as soon as ShipMova launches.",
  },
  seller: {
    heading: "Get notified when we launch — list your car early",
    intro:
      "Leave an email or WhatsApp number and we'll tell you as soon as buyers can reserve. You can list your car now.",
    success: "We'll message you as soon as buyers can reserve on ShipMova.",
  },
};

/**
 * Pre-launch waitlist form: an email or WhatsApp number, plus a country.
 * Stands in for Reserve and the ShipMova-fee step, and sits on the homepage,
 * /how-it-works, an empty /browse, and (seller version) /sell.
 */
export function WaitlistForm({
  source,
  audience = "buyer",
  vehicleId,
  heading,
  intro,
  compact = false,
  className,
}: {
  source: WaitlistSource;
  audience?: BuyerOrSeller;
  vehicleId?: string;
  heading?: string;
  intro?: string;
  /** One column even on wide screens (the listing page's side column). */
  compact?: boolean;
  className?: string;
}) {
  const [state, action, pending] = useActionState(joinWaitlist, null);
  const copy = COPY[audience];

  if (state?.ok) {
    return (
      <div
        role="status"
        className={cn(
          "flex items-start gap-3 rounded-card border border-verified-100 bg-verified-50 p-5",
          className,
        )}
      >
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-verified-600" aria-hidden />
        <div>
          <p className="font-semibold text-ink">You&rsquo;re on the list.</p>
          <p className="mt-1 text-sm text-muted">{copy.success}</p>
        </div>
      </div>
    );
  }

  return (
    <form
      action={action}
      className={cn("rounded-card border border-line bg-white p-5 text-left shadow-card", className)}
    >
      <h2 className="font-display text-xl font-bold text-ink">{heading ?? copy.heading}</h2>
      <p className="mt-1 text-sm text-muted">{intro ?? copy.intro}</p>
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="audience" value={audience} />
      {vehicleId ? <input type="hidden" name="vehicleId" value={vehicleId} /> : null}

      <div className={cn("mt-4 grid gap-3", !compact && "sm:grid-cols-3")}>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Email
          <input
            type="email"
            name="email"
            autoComplete="email"
            className={inputClasses()}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          or WhatsApp number
          <input
            type="tel"
            name="whatsapp"
            autoComplete="tel"
            placeholder="+234 803 123 4567"
            className={inputClasses()}
          />
          <span className="text-xs text-muted">
            With or without the country code — we&rsquo;ll add it from your country.
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Country
          <select
            name="country"
            required
            defaultValue=""
            className={inputClasses()}
          >
            <option value="" disabled>
              Choose your country
            </option>
            {WAITLIST_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {state && !state.ok ? (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-copper-100 bg-copper-50 p-3 text-sm text-copper-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{state.error}</span>
        </div>
      ) : null}

      <Button type="submit" className={cn("mt-4", compact ? "w-full" : "w-full sm:w-auto")} disabled={pending}>
        {pending ? "Joining…" : audience === "seller" ? "Notify me" : "Join the waitlist"}
      </Button>
    </form>
  );
}
