// Proves a shipper login can't reserve or message a seller (0065), against
// the real database, signed in as that shipper — the same client the
// Reserve and Message seller server actions use.
//
//   npm run e2e:shipper-not-buyer
//
// E2E_BUYER_EMAIL / E2E_BUYER_PASSWORD (.env.local) must be a login linked
// to a shipper application — the shipper-insurance e2e links one. The
// service-role key only counts rows before and after; it never writes.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.E2E_BUYER_EMAIL;
const password = process.env.E2E_BUYER_PASSWORD;
if (!url || !anonKey || !serviceKey || !email || !password) {
  console.error("Missing Supabase URL/keys or E2E_BUYER_EMAIL/PASSWORD in .env.local");
  process.exit(2);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const shipper = createClient(url, anonKey, { auth: { persistSession: false } });

let failed = 0;
function check(label, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

const { data: signIn, error: signInError } = await shipper.auth.signInWithPassword({ email, password });
if (signInError) {
  console.error("Sign-in failed:", signInError.message);
  process.exit(2);
}
const userId = signIn.user.id;

const { data: kind } = await shipper.rpc("my_service_account_kind");
check("the database calls this login a shipper", kind === "shipper", `my_service_account_kind() = ${kind}`);

// Any car will do: the guard runs before every other check on the row.
const { data: car } = await admin.from("vehicles").select("id, seller_id").limit(1).single();
if (!car) {
  console.error("No vehicle row to aim at.");
  process.exit(2);
}

async function counts() {
  const [pr, conv] = await Promise.all([
    admin.from("purchase_requests").select("id", { count: "exact", head: true }).eq("buyer_id", userId),
    admin.from("conversations").select("id", { count: "exact", head: true }).eq("buyer_id", userId),
  ]);
  return { reservations: pr.count, chats: conv.count };
}
const before = await counts();

// Reserve: what reserveVehicle() inserts, sent straight to the database.
const reserve = await shipper
  .from("purchase_requests")
  .insert({ vehicle_id: car.id, buyer_id: userId })
  .select("id");
check(
  "reserving is refused by the database",
  reserve.error?.message === "service_account_not_buyer",
  reserve.error ? `${reserve.error.code} ${reserve.error.message}` : "NOT refused",
);

// Message seller: what openConversation() inserts.
const chat = await shipper
  .from("conversations")
  .insert({ vehicle_id: car.id, buyer_id: userId, seller_id: car.seller_id })
  .select("id");
check(
  "messaging the seller is refused by the database",
  chat.error?.message === "service_account_not_buyer",
  chat.error ? `${chat.error.code} ${chat.error.message}` : "NOT refused",
);

const after = await counts();
check(
  "nothing was created",
  before.reservations === after.reservations && before.chats === after.chats,
  `reservations ${before.reservations}→${after.reservations}, buyer chats ${before.chats}→${after.chats}`,
);

await shipper.auth.signOut();
console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
