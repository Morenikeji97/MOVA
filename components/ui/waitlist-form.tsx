"use client";

import { useActionState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  WAITLIST_COUNTRIES,
  type WaitlistAudience,
  type WaitlistSource,
} from "@/lib/prelaunch";
import { joinWaitlist } from "@/app/waitlist/actions";

const COPY: Record<WaitlistAudience, { heading: string; intro: string; success: string }> = {
  buyer: {
    heading: "Join the waitlist",
    intro:
      "MOVA isn't taking reservations or payments yet. Leave an email or WhatsApp number and we'll tell you the moment we launch.",
    success: "We'll message you as soon as MOVA launches.",
  },
  seller: {
    heading: "Get notified when we launch — list your car early",
    intro:
      "Leave an email or WhatsApp number and we'll tell you as soon as buyers can reserve. You can list your car now.",
    success: "We'll message you as soon as buyers can reserve on MOVA.",
  },
};

/**
 * Pre-launch waitlist form: an email or WhatsApp number, plus a country.
 * Stands in for Reserve and the MOVA-fee step, and sits on the homepage,
 * /how-it-works, an empty /browse, and (seller version) /sell.
 */
export function WaitlistForm({
  source,
  audience = "buyer",
  vehicleId,
  heading,
  intro,
  className,
}: {
  source: WaitlistSource;
  audience?: WaitlistAudience;
  vehicleId?: string;
  heading?: string;
  intro?: string;
  className?: string;
}) {
  const [state, action, pending] = useActionState(joinWaitlist, null);
  const copy = COPY[audience];

  if (state?.ok) {
    return (
      <div
        role="status"
        className={cn(
          "flex items-start gap-3 rounded-lg border border-verified-100 bg-verified-50 p-5",
          className,
        )}
      >
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-verified-600" aria-hidden />
        <div>
          <p className="font-semibold text-black">You&rsquo;re on the list.</p>
          <p className="mt-1 text-sm text-gray-500">{copy.success}</p>
        </div>
      </div>
    );
  }

  return (
    <form
      action={action}
      className={cn("rounded-lg border border-gray-200 bg-white p-5 text-left", className)}
    >
      <h2 className="font-semibold text-black">{heading ?? copy.heading}</h2>
      <p className="mt-1 text-sm text-gray-500">{intro ?? copy.intro}</p>
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="audience" value={audience} />
      {vehicleId ? <input type="hidden" name="vehicleId" value={vehicleId} /> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm text-gray-500">
          Email
          <input
            type="email"
            name="email"
            autoComplete="email"
            className="rounded border border-gray-200 px-3 py-2 text-black"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-500">
          or WhatsApp number
          <input
            type="tel"
            name="whatsapp"
            autoComplete="tel"
            placeholder="+234 803 123 4567"
            className="rounded border border-gray-200 px-3 py-2 text-black"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-500">
          Country
          <select
            name="country"
            required
            defaultValue=""
            className="rounded border border-gray-200 bg-white px-3 py-2 text-black"
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
          className="mt-3 flex items-start gap-2 rounded border border-copper-100 bg-copper-50 p-3 text-sm text-copper-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{state.error}</span>
        </div>
      ) : null}

      <Button type="submit" className="mt-4" disabled={pending}>
        {pending ? "Joining…" : audience === "seller" ? "Notify me" : "Join the waitlist"}
      </Button>
    </form>
  );
}
