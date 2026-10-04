"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SHIPPER_TERMS_VERSION, isServiceCountry } from "@/lib/shipping";
import { isUsState } from "@/lib/us-states";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Shipper signup from /shipper/signup.
 *
 * Records a `pending` shipper (company info + FMC OTI license + the accepted
 * shipper terms, versioned and timestamped) for admin review. No card and no
 * Stripe: shippers pay nothing while SHIPPER_FEES_ENABLED is false
 * (lib/shipping.ts). If fees return, a card step belongs back here — see git
 * history for the Stripe setup-mode Checkout that used to follow the insert.
 *
 * Works for logged-out visitors (user_id stays null). Failures redirect back to
 * the form with an ?error code rather than throwing at the applicant.
 */
export async function submitShipperSignup(formData: FormData): Promise<void> {
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

  if (!companyName || !contactName || !contactEmail || !licenseNumber) {
    redirect("/shipper/signup?error=missing");
  }
  if (serviceCountries.length === 0) {
    redirect("/shipper/signup?error=countries");
  }
  if (serviceAreas.length === 0) {
    redirect("/shipper/signup?error=areas");
  }
  if (!termsAccepted) {
    redirect("/shipper/signup?error=terms");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Client-generated id so we don't need an RLS SELECT path back to a
  // freshly-inserted anonymous row.
  const shipperId = crypto.randomUUID();

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
    redirect("/shipper/signup?error=server");
  }

  redirect("/shipper/signup/success");
}
