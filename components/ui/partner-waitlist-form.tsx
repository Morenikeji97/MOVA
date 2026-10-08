"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NIGERIA_PORTS } from "@/lib/prelaunch";
import { joinPartnerWaitlist } from "@/app/waitlist/actions";
import { inputClasses } from "@/components/ui/input-classes";

const input = inputClasses();

/**
 * "Register your interest" form for partners — /inspectors (U.S.) and
 * /clearing-agents (Nigeria). Stored in the same insert-only waitlist
 * table as buyers and sellers, with the partner's audience.
 */
export function PartnerWaitlistForm({
  audience,
  className,
}: {
  audience: "inspector" | "clearing_agent";
  className?: string;
}) {
  const [state, action, pending] = useActionState(joinPartnerWaitlist, null);
  const isInspector = audience === "inspector";

  if (state?.ok) {
    return (
      <div
        role="status"
        className={cn("flex items-start gap-3 rounded-card border border-verified-100 bg-verified-50 p-5", className)}
      >
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-verified-600" aria-hidden />
        <div>
          <p className="font-semibold text-ink">Thanks — you&rsquo;re registered.</p>
          <p className="mt-1 text-sm text-muted">
            We&rsquo;ll be in touch on WhatsApp or email as ShipMova gets ready to launch.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className={cn("rounded-card border border-line bg-white p-5 shadow-card", className)}>
      <h2 className="font-display text-xl font-bold text-ink">
        {isInspector ? "Register your interest" : "Become a partner agent"}
      </h2>
      <input type="hidden" name="audience" value={audience} />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-muted">
          Your name
          <input name="full_name" required autoComplete="name" className={input} />
        </label>
        {isInspector ? null : (
          <label className="flex flex-col gap-1 text-sm text-muted">
            Company
            <input name="company" required autoComplete="organization" className={input} />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm text-muted">
          Email
          <input name="email" type="email" required autoComplete="email" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          WhatsApp number
          <input
            name="whatsapp"
            type="tel"
            required
            autoComplete="tel"
            placeholder={isInspector ? "(631) 617-3816" : "0803 123 4567"}
            className={input}
          />
        </label>
        {isInspector ? (
          <label className="flex flex-col gap-1 text-sm text-muted">
            City and state
            <input name="city_state" required placeholder="Houston, TX" className={input} />
          </label>
        ) : null}
      </div>

      {isInspector ? (
        <label className="mt-3 flex flex-col gap-1 text-sm text-muted">
          Your car experience
          <textarea
            name="experience"
            required
            maxLength={1000}
            rows={3}
            placeholder="e.g. mechanic for 8 years, ASE-certified, detailing, restoring cars…"
            className={inputClasses({ multiline: true })}
          />
        </label>
      ) : (
        <>
          <fieldset className="mt-3 flex flex-col gap-2">
            <legend className="text-sm text-muted">Ports you serve</legend>
            <div className="flex flex-wrap gap-3">
              {NIGERIA_PORTS.map((p) => (
                <label key={p} className="flex h-11 items-center gap-2 pr-2 text-sm text-ink">
                  <input type="checkbox" name="ports" value={p} className="h-5 w-5 accent-ink" />
                  {p}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="mt-3 flex flex-col gap-1 text-sm text-muted">
            License / CAC number <span className="text-xs">(optional)</span>
            <input name="license_number" maxLength={80} className={input} />
          </label>
        </>
      )}

      {state && !state.ok ? (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-copper-100 bg-copper-50 p-3 text-sm text-copper-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{state.error}</span>
        </div>
      ) : null}

      <Button type="submit" className="mt-4 w-full sm:w-auto" disabled={pending}>
        {pending ? "Sending…" : isInspector ? "Register your interest" : "Become a partner agent"}
      </Button>
    </form>
  );
}
