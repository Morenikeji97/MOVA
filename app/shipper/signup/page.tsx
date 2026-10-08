"use client";

import { Suspense, useActionState, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { SERVICE_COUNTRIES, SHIPPER_NO_FEES_HEADLINE } from "@/lib/shipping";
import { US_STATES } from "@/lib/us-states";
import { submitShipperSignup, type ShipperSignupState } from "./actions";
import { inputClasses } from "@/components/ui/input-classes";

const inputClass = inputClasses();

const ERROR_COPY: Record<string, string> = {
  missing: "Please fill in the company name, contact name, email, and FMC OTI license number.",
  countries: "Select at least one country you ship to.",
  areas: "Select at least one US state you pick up vehicles from.",
  terms: "Please accept ShipMova's Terms & Conditions to apply.",
  server: "Something went wrong saving your application. Please try again.",
};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? "Submitting…" : "Submit application"}
    </Button>
  );
}

const INITIAL: ShipperSignupState = {
  error: null,
  values: {
    company_name: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    fmc_oti_license_number: "",
    service_countries: [],
    service_areas: [],
  },
};

function ShipperSignupForm() {
  const searchParams = useSearchParams();
  // The action returns errors (with everything typed) rather than
  // redirecting; ?error= still works for links into the page.
  const [state, formAction] = useActionState(submitShipperSignup, INITIAL);
  const error = state.error ?? searchParams.get("error");
  const errorText = error ? (ERROR_COPY[error] ?? "Please check the form and try again.") : null;
  const v = state.values;
  const [termsAccepted, setTermsAccepted] = useState(false);

  return (
    <main className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/"
        className="flex h-11 w-fit items-center text-sm font-semibold text-muted hover:text-ink"
      >
        &larr; ShipMova
      </Link>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink">
        Become a ShipMova shipper
      </h1>
      <p className="mt-2 text-sm text-muted">
        List your shipping rates to reach international buyers. Applications are
        reviewed by our team before your rates go live.
      </p>

      {error ? (
        <p className="mt-6 rounded-lg border border-copper-100 bg-copper-50 p-3 text-sm text-copper-700">
          {errorText}
        </p>
      ) : null}

      <form action={formAction} className="mt-8 flex flex-col gap-5">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">Company name</span>
          <input name="company_name" required defaultValue={v.company_name} autoComplete="organization" className={inputClass} />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">Contact name</span>
            <input name="contact_name" required defaultValue={v.contact_name} autoComplete="name" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">Contact email</span>
            <input
              type="email"
              name="contact_email"
              defaultValue={v.contact_email}
              autoComplete="email"
              required
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">Contact phone</span>
            <input name="contact_phone" type="tel" defaultValue={v.contact_phone} autoComplete="tel" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">FMC OTI license number</span>
            <input
              name="fmc_oti_license_number"
              defaultValue={v.fmc_oti_license_number}
              required
              className={inputClass}
            />
          </label>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm text-muted">Countries you ship to</legend>
          <div className="mt-1 flex flex-wrap gap-3">
            {SERVICE_COUNTRIES.map((c) => (
              <label
                key={c.code}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm text-ink"
              >
                <input
                  type="checkbox"
                  name="service_countries"
                  value={c.code}
                  defaultChecked={v.service_countries.includes(c.code)}
                  className="h-5 w-5 accent-ink"
                />
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm text-muted">
            US states you pick up vehicles from
          </legend>
          <p className="text-xs text-muted">
            Buyers see you flagged as a local, likely-cheaper pickup option
            for vehicles located in these states.
          </p>
          <div className="mt-1 grid max-h-56 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-line bg-white p-3 sm:grid-cols-3">
            {US_STATES.map(([code, name]) => (
              <label
                key={code}
                className="inline-flex min-h-11 items-center gap-2 text-sm text-ink"
              >
                <input
                  type="checkbox"
                  name="service_areas"
                  value={code}
                  defaultChecked={v.service_areas.includes(code)}
                  className="h-5 w-5 accent-ink"
                />
                {name}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="rounded-lg border border-verified-100 bg-verified-50 p-4 text-sm text-verified-600">
          <p className="font-semibold">{SHIPPER_NO_FEES_HEADLINE}</p>
          <p className="mt-1">
            ShipMova charges you nothing: no commission and no card on file. If that
            ever changes, we&rsquo;ll tell you first and ask you to accept new terms.
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-line bg-white p-4">
          <input
            type="checkbox"
            name="terms_accepted"
            required
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
          />
          <span className="text-sm text-ink">
            I agree to ShipMova&rsquo;s{" "}
            <Link href="/policies/terms" className="underline" target="_blank">
              Terms &amp; Conditions
            </Link>
            .
          </span>
        </label>

        <div className="flex items-center gap-4">
          <SubmitButton disabled={!termsAccepted} />
        </div>
        {/* Repeated by the button: after tapping Submit on a phone you're at
            the bottom of the form, not looking at the top. */}
        {errorText ? (
          <p role="alert" className="text-sm text-copper-700">
            {errorText}
          </p>
        ) : null}
        <div className="flex items-center gap-4">
          <Link
            href="/shipper/portal"
            className="text-sm text-muted hover:text-ink"
          >
            Already approved? Go to the shipper portal
          </Link>
        </div>
      </form>
    </main>
  );
}

export default function ShipperSignupPage() {
  return (
    <Suspense fallback={null}>
      <ShipperSignupForm />
    </Suspense>
  );
}
