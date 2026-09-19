"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { SERVICE_COUNTRIES } from "@/lib/shipping";
import { US_STATES } from "@/lib/us-states";
import { submitShipperSignup } from "./actions";

const inputClass =
  "h-11 rounded border border-gray-200 bg-white px-3 text-black";

const ERROR_COPY: Record<string, string> = {
  missing: "Please fill in the company name, contact name, email, and FMC OTI license number.",
  countries: "Select at least one country you ship to.",
  areas: "Select at least one US state you pick up vehicles from.",
  terms: "You must accept the commission terms to sign up.",
  card_cancelled:
    "Card setup was cancelled. Your application is saved — you can add a card by signing up again with the same details.",
  stripe: "We couldn't start card setup just now. Please try again.",
  server: "Something went wrong saving your application. Please try again.",
};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? "Starting card setup…" : "Continue to card setup"}
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
        &larr; MOVA
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-black">
        Become a MOVA shipper
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

        <label className="flex items-start gap-3 rounded border border-gray-200 bg-white p-4">
          <input
            type="checkbox"
            name="terms_accepted"
            required
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span className="text-sm text-black">
            I agree to pay MOVA an 8% commission on completed shipments arranged
            through the platform.
          </span>
        </label>

        <p className="text-sm text-gray-500">
          Next you&rsquo;ll add a card on Stripe&rsquo;s secure page. Nothing is
          charged now — it&rsquo;s kept on file so MOVA can collect the 8%
          commission after a shipment is completed.
        </p>

        <div className="flex items-center gap-4">
          <SubmitButton disabled={!termsAccepted} />
          <Link
            href="/shipper"
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
