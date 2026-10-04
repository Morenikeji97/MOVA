"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { SERVICE_COUNTRIES, SHIPPER_NO_FEES_HEADLINE } from "@/lib/shipping";
import { US_STATES } from "@/lib/us-states";
import { submitShipperSignup } from "./actions";
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

function ShipperSignupForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [termsAccepted, setTermsAccepted] = useState(false);

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <Link
        href="/"
        className="font-mono text-xs uppercase tracking-wider text-gray-500 hover:text-black"
      >
        &larr; ShipMova
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-black">
        Become a ShipMova shipper
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        List your shipping rates to reach international buyers. Applications are
        reviewed by our team before your rates go live.
      </p>

      {error ? (
        <p className="mt-6 rounded border border-copper-100 bg-copper-50 p-3 text-sm text-copper-700">
          {ERROR_COPY[error] ?? "Please check the form and try again."}
        </p>
      ) : null}

      <form action={submitShipperSignup} className="mt-8 flex flex-col gap-5">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-500">Company name</span>
          <input name="company_name" required className={inputClass} />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500">Contact name</span>
            <input name="contact_name" required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500">Contact email</span>
            <input
              type="email"
              name="contact_email"
              required
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500">Contact phone</span>
            <input name="contact_phone" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500">FMC OTI license number</span>
            <input
              name="fmc_oti_license_number"
              required
              className={inputClass}
            />
          </label>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm text-gray-500">Countries you ship to</legend>
          <div className="mt-1 flex flex-wrap gap-3">
            {SERVICE_COUNTRIES.map((c) => (
              <label
                key={c.code}
                className="inline-flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-sm text-black"
              >
                <input
                  type="checkbox"
                  name="service_countries"
                  value={c.code}
                  className="h-4 w-4"
                />
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm text-gray-500">
            US states you pick up vehicles from
          </legend>
          <p className="text-xs text-gray-500">
            Buyers see you flagged as a local, likely-cheaper pickup option
            for vehicles located in these states.
          </p>
          <div className="mt-1 grid max-h-56 grid-cols-2 gap-2 overflow-y-auto rounded border border-gray-200 bg-white p-3 sm:grid-cols-3">
            {US_STATES.map(([code, name]) => (
              <label
                key={code}
                className="inline-flex items-center gap-2 text-sm text-black"
              >
                <input
                  type="checkbox"
                  name="service_areas"
                  value={code}
                  className="h-4 w-4"
                />
                {name}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="rounded border border-verified-100 bg-verified-50 p-4 text-sm text-verified-600">
          <p className="font-medium">{SHIPPER_NO_FEES_HEADLINE}</p>
          <p className="mt-1">
            ShipMova charges you nothing: no commission and no card on file. If that
            ever changes, we&rsquo;ll tell you first and ask you to accept new terms.
          </p>
        </div>

        <label className="flex items-start gap-3 rounded border border-gray-200 bg-white p-4">
          <input
            type="checkbox"
            name="terms_accepted"
            required
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0"
          />
          <span className="text-sm text-black">
            I agree to ShipMova&rsquo;s{" "}
            <Link href="/terms" className="underline" target="_blank">
              Terms &amp; Conditions
            </Link>
            .
          </span>
        </label>

        <div className="flex items-center gap-4">
          <SubmitButton disabled={!termsAccepted} />
          <Link
            href="/shipper/portal"
            className="text-sm text-gray-500 hover:text-black"
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
