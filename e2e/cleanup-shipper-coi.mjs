// Removes what e2e/shipper-coi.webkit.mjs creates: the "E2E Test Shipper
// (delete me)" application of the private test account and its uploaded
// certificate files. Touches nothing else. Service role, from .env.local.
//   node --env-file=.env.local e2e/cleanup-shipper-coi.mjs
import { createClient } from "@supabase/supabase-js";
const email = process.env.E2E_BUYER_EMAIL;
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: user } = await admin.from("users").select("id").eq("email", email).single();
const { data: files } = await admin.storage.from("shipper-insurance-documents").list(user.id);
if (files?.length) {
  const { error } = await admin.storage.from("shipper-insurance-documents").remove(files.map((f) => `${user.id}/${f.name}`));
  console.log(error ? `files: ${error.message}` : `removed ${files.length} certificate file(s)`);
}
const { data: gone, error } = await admin
  .from("shippers")
  .delete()
  .eq("user_id", user.id)
  .eq("contact_email", email)
  .like("company_name", "E2E Test Shipper%")
  .select("company_name");
console.log(error ? `application: ${error.message}` : `deleted ${gone.length} test application(s)`);
