"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SHIPPER_TERMS_VERSION, isServiceCountry } from "@/lib/shipping";
import { isUsState } from "@/lib/us-states";
import { notifyShipperApplication } from "@/lib/notifications";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Shipper signup from /shipper/signup.
 *
 * Records a `pending` shipper (company info + FMC OTI license + the accepted
 * shipper terms, versioned and timestamped) for admin review, then emails the
 * applicant a confirmation and every admin an alert. It creates an
 * application only, not a login: the shipper makes an account after approval. No card and no
 * Stripe: shippers pay nothing while SHIPPER_FEES_ENABLED is false
 * (lib/shipping.ts). If fees return, a card step belongs back here — see git
 * history for the Stripe setup-mode Checkout that used to follow the insert.
 *
 * Works for logged-out visitors (user_id stays null). Failures redirect back to
 * the form with an ?error code rather than throwing at the applicant.
 */
export type ShipperSignupValues = {
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  fmc_oti_license_number: string;
  service_countries: string[];
  service_areas: string[];
};

/** What the form gets back on failure: which error, and everything typed. */
export type ShipperSignupState = {
  error: "missing" | "countries" | "areas" | "terms" | "server" | null;
  values: ShipperSignupValues;
};

export async function submitShipperSignup(
  _prev: ShipperSignupState,
  formData: FormData,
): Promise<ShipperSignupState> {
  const companyName = str(formData.get("company_name"));
  const contactName = str(formData.get("contact_name"));
  const contactEmail = str(formData.get("contact_email"));
  const contactPhone = str(formData.get("contact_phone"));
  const licenseNumber = str(formData.get("fmc_oti_license_number"));
  const serviceCountries = formData
    .getAll("service_countries")
    .map((c) => str(c))
    .filter((c) => isServiceCountry(c));
  const serviceAreas = formData
    .getAll("service_areas")
    .map((c) => str(c))
    .filter((c) => isUsState(c));
  // Checkbox: only present in the payload when ticked.
  const termsAccepted = formData.get("terms_accepted") != null;

  // Errors come back to the same form with everything typed, so a phone
  // user never has to fill it in again.
  const values: ShipperSignupValues = {
    company_name: companyName,
    contact_name: contactName,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    fmc_oti_license_number: licenseNumber,
    service_countries: serviceCountries,
    service_areas: serviceAreas,
  };
  if (!companyName || !contactName || !contactEmail || !licenseNumber) {
    return { error: "missing", values };
  }
  if (serviceCountries.length === 0) return { error: "countries", values };
  if (serviceAreas.length === 0) return { error: "areas", values };
  if (!termsAccepted) return { error: "terms", values };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Client-generated id so we don't need an RLS SELECT path back to a
  // freshly-inserted anonymous row.
  const shipperId = crypto.randomUUID();

  let insertFailed = false;
  try {
    const { error: insertError } = await supabase.from("shippers").insert({
      id: shipperId,
      user_id: user?.id ?? null,
      company_name: companyName,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contactPhone || null,
      fmc_oti_license_number: licenseNumber,
      service_countries: serviceCountries,
      service_areas: serviceAreas,
      status: "pending",
      terms_accepted_at: new Date().toISOString(),
      terms_version: SHIPPER_TERMS_VERSION,
    });
    if (insertError) {
      console.error("shipper signup insert failed:", insertError);
      insertFailed = true;
    }
  } catch (err) {
    // A thrown failure (e.g. network) must still reach the applicant as an
    // error, never a blank page or a false "received".
    console.error("shipper signup insert threw:", err);
    insertFailed = true;
  }
  // redirect() works by throwing, so it stays outside the try/catch above.
  if (insertFailed) return { error: "server", values };

  // The application is saved. Confirm to the applicant and alert admins; if
  // the confirmation email didn't go out, the success page says so.
  const { applicantEmailed } = await notifyShipperApplication(shipperId).catch((err) => {
    console.error("shipper application emails failed:", err);
    return { applicantEmailed: false };
  });
  redirect(applicantEmailed ? "/shipper/signup/success" : "/shipper/signup/success?email=failed");
}
