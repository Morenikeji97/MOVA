"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isServiceCountry, type ServiceCountryCode } from "@/lib/shipping";
import { isUsState } from "@/lib/us-states";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Edits the fields the owning shipper is actually allowed to touch. RLS
 * ("shippers owner update" + the shippers_guard_owner_editable_fields
 * trigger, 0016; service_areas added in 0029) enforces that —
 * company_name/service_countries/service_areas/description are the only
 * columns that don't revert — this action doesn't need to duplicate that
 * logic, only shape the update it sends.
 */
export async function updateShipperProfile(formData: FormData): Promise<void> {
  const companyName = str(formData.get("companyName"));
  const description = str(formData.get("description"));
  const serviceCountries = formData
    .getAll("serviceCountries")
    .map((v) => str(v))
    .filter((c): c is ServiceCountryCode => isServiceCountry(c));
  const serviceAreas = formData
    .getAll("serviceAreas")
    .map((v) => str(v))
    .filter((c) => isUsState(c));
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
      service_areas: serviceAreas,
    })
    .eq("user_id", user.id);

  revalidatePath("/shipper/profile");
  revalidatePath("/shipper/dashboard");
}
