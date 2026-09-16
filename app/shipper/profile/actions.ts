"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isServiceCountry, type ServiceCountryCode } from "@/lib/shipping";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Edits the three fields the owning shipper is actually allowed to touch.
 * RLS ("shippers owner update" + the shippers_guard_owner_editable_fields
 * trigger, 0016) enforces that — company_name/service_countries/description
 * are the only columns that don't revert — this action doesn't need to
 * duplicate that logic, only shape the update it sends.
 */
export async function updateShipperProfile(formData: FormData): Promise<void> {
  const companyName = str(formData.get("companyName"));
  const description = str(formData.get("description"));
  const serviceCountries = formData
    .getAll("serviceCountries")
    .map((v) => str(v))
    .filter((c): c is ServiceCountryCode => isServiceCountry(c));
  if (!companyName) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("shippers")
    .update({
      company_name: companyName,
      description: description || null,
      service_countries: serviceCountries,
    })
    .eq("user_id", user.id);

  revalidatePath("/shipper/profile");
  revalidatePath("/shipper/dashboard");
}
