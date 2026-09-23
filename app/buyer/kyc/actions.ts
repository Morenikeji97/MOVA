"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { lookupNin, lookupBvn } from "@/lib/dojah";
import { isValidNinOrBvn, overallBuyerVerificationStatus } from "@/lib/kyc";
import { evaluateReferralQualification } from "@/lib/referral-credit";

export type KycVerifyResult =
  | { ok: true; verified: boolean }
  | { ok: false; error: string };

export async function verifyBuyerIdentity(
  kind: "nin" | "bvn",
  formData: FormData,
): Promise<KycVerifyResult> {
  const value = formData.get("value");
  if (typeof value !== "string" || !isValidNinOrBvn(value)) {
    return {
      ok: false,
      error: `Enter your 11-digit ${kind.toUpperCase()}.`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You need to be signed in to verify your identity." };
  }

  const allowed = await checkRateLimit(`kyc:${user.id}`, 5, 60 * 60);
  if (!allowed) {
    return { ok: false, error: RATE_LIMIT_MESSAGE };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("buyer_profiles")
    .select("full_name, nin_verification_status, bvn_verification_status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) {
    return { ok: false, error: "Buyer profile not found." };
  }

  let result;
  try {
    result = kind === "nin" ? await lookupNin(value) : await lookupBvn(value);
  } catch (err) {
    console.error(`Dojah ${kind} lookup failed:`, err);
    return {
      ok: false,
      error: "Couldn't reach the verification service — try again in a moment.",
    };
  }

  const nextNinStatus = kind === "nin" ? result.status : profile.nin_verification_status;
  const nextBvnStatus = kind === "bvn" ? result.status : profile.bvn_verification_status;
  const verifiedName =
    result.status === "verified"
      ? [result.firstName, result.lastName].filter(Boolean).join(" ").trim()
      : "";

  const { error } = await admin
    .from("buyer_profiles")
    .update({
      nin_verification_status: nextNinStatus,
      bvn_verification_status: nextBvnStatus,
      verification_status: overallBuyerVerificationStatus(nextNinStatus, nextBvnStatus),
      ...(verifiedName && !profile.full_name ? { full_name: verifiedName } : {}),
    })
    .eq("user_id", user.id);

  if (error) {
    console.error("buyer_profiles KYC update failed:", error);
    return { ok: false, error: "Something went wrong saving your verification — try again." };
  }

  if (result.status === "verified") {
    const { data: paidRequest } = await admin
      .from("purchase_requests")
      .select("id")
      .eq("buyer_id", user.id)
      .eq("mova_fee_payment_status", "paid")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (paidRequest) {
      await evaluateReferralQualification(admin, {
        referredUserId: user.id,
        purchaseRequestId: paidRequest.id,
      });
    }
  }

  revalidatePath("/buyer/dashboard");
  return { ok: true, verified: result.status === "verified" };
}
