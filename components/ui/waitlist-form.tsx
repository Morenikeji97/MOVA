"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WAITLIST_COUNTRIES } from "@/lib/prelaunch";
import { joinWaitlist } from "@/app/waitlist/actions";

/**
 * Pre-launch "Join the waitlist" form: an email or WhatsApp number, plus a
 * country. Stands in for Reserve on a listing and for the MOVA-fee payment
 * step on the buyer dashboard while PRELAUNCH is on.
 */
export function WaitlistForm({
  source,
  vehicleId,
  heading = "Join the waitlist",
  intro = "MOVA isn't taking reservations or payments yet. Leave an email or WhatsApp number and we'll tell you the moment we launch.",
  className,
}: {
  source: "site" | "listing" | "dashboard";
  vehicleId?: string;
  heading?: string;
  intro?: string;
  className?: string;
}) {
  const [state, action, pending] = useActionState(joinWaitlist, null);

  if (state?.ok) {
    return (
      <div className={cn("rounded-lg border border-verified-100 bg-verified-50 p-5", className)}>
        <p className="font-semibold text-black">You&rsquo;re on the list.</p>
        <p className="mt-1 text-sm text-gray-500">
          We&rsquo;ll be in touch as soon as MOVA launches.
        </p>
      </div>
    );
  }

  return (
    <form
      action={action}
      className={cn("rounded-lg border border-gray-200 bg-white p-5", className)}
    >
      <h2 className="font-semibold text-black">{heading}</h2>
      <p className="mt-1 text-sm text-gray-500">{intro}</p>
      <input type="hidden" name="source" value={source} />
      {vehicleId ? <input type="hidden" name="vehicleId" value={vehicleId} /> : null}

      <div className="mt-4 grid gap-3">
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
            className="rounded border border-gray-200 px-3 py-2 text-black"
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
        <p className="mt-3 text-sm text-copper-700" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="mt-4" disabled={pending}>
        {pending ? "Joining…" : "Join the waitlist"}
      </Button>
    </form>
  );
}
