import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ID_CHECK_REQUIRED_TO_RESERVE } from "@/lib/id-verification";
import { SERVICE_ACCOUNT_NOT_BUYER, serviceAccountKind } from "@/lib/account-kind";

/**
 * Server-side half of the buyer ID gate (middleware.ts is the other): a
 * buyer whose ID isn't verified can't chat or reserve. Neither can a shipper
 * login, verified or not — it isn't a buyer (lib/account-kind.ts; the
 * database refuses it too, 0065). Returns the message to show, or null when
 * the caller isn't a buyer or is a verified one.
 */
export async function unverifiedBuyerMessage(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  const [{ data: account }, { data: kind }] = await Promise.all([
    supabase.from("users").select("role").eq("id", userId).maybeSingle(),
    supabase.rpc("my_service_account_kind"),
  ]);
  const accountKind = serviceAccountKind(kind);
  if (accountKind) return SERVICE_ACCOUNT_NOT_BUYER[accountKind];
  if (account?.role !== "buyer") return null;
  const { data: buyer } = await supabase
    .from("buyer_profiles")
    .select("verification_status")
    .eq("user_id", userId)
    .maybeSingle();
  return buyer?.verification_status === "verified" ? null : ID_CHECK_REQUIRED_TO_RESERVE;
}
