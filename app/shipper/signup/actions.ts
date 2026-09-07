"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { appUrl } from "@/lib/app-url";
import { isServiceCountry } from "@/lib/shipping";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Shipper signup from /shipper/signup.
 *
 * 1. Records a `pending` shipper (company info + FMC OTI license + the accepted
 *    8%-commission terms, timestamped).
 * 2. Creates a Stripe Customer and a hosted Checkout session in `setup` mode to
 *    save a card for future off-session commission charges — nothing is charged
 *    now. The saved payment method + customer id are written back by the
 *    shipper-commission webhook on `checkout.session.completed`.
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
  // Checkbox: only present in the payload when ticked.
  const termsAccepted = formData.get("terms_accepted") != null;

  if (!companyName || !contactName || !contactEmail || !licenseNumber) {
    redirect("/shipper/signup?error=missing");
  }
  if (serviceCountries.length === 0) {
    redirect("/shipper/signup?error=countries");
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
    status: "pending",
    terms_accepted_at: new Date().toISOString(),
  });

  if (insertError) {
    console.error("shipper signup insert failed:", insertError);
    redirect("/shipper/signup?error=server");
  }

  let redirectUrl: string | null = null;
  try {
    const stripe = getStripe();
    const customer = await stripe.customers.create({
      name: companyName,
      email: contactEmail,
      metadata: { shipper_id: shipperId },
    });
    const origin = await appUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      customer: customer.id,
      payment_method_types: ["card"],
      metadata: { shipper_id: shipperId },
      setup_intent_data: { metadata: { shipper_id: shipperId } },
      success_url: `${origin}/shipper/signup/success`,
      cancel_url: `${origin}/shipper/signup?error=card_cancelled`,
    });
    redirectUrl = session.url ?? null;
  } catch (err) {
    console.error("shipper signup Stripe setup failed:", err);
    redirect("/shipper/signup?error=stripe");
  }

  if (!redirectUrl) redirect("/shipper/signup?error=stripe");
  redirect(redirectUrl);
}
