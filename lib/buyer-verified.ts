import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ID_CHECK_REQUIRED_TO_RESERVE } from "@/lib/id-verification";

/**
 * Server-side half of the buyer ID gate (middleware.ts is the other): a
 * buyer whose ID isn't verified can't chat or reserve. Returns the message
 * to show, or null when the caller isn't a buyer or is verified.
 */
export async function unverifiedBuyerMessage(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  const { data: account } = await supabase.from("users").select("role").eq("id", userId).maybeSingle();
  if (account?.role !== "buyer") return null;
  const { data: buyer } = await supabase
    .from("buyer_profiles")
    .select("verification_status")
    .eq("user_id", userId)
    .maybeSingle();
  return buyer?.verification_status === "verified" ? null : ID_CHECK_REQUIRED_TO_RESERVE;
}
