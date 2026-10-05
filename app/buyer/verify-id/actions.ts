"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { lookupGhanaCard, lookupNin } from "@/lib/dojah";
import {
  ID_CHECK_OPENS_AT_LAUNCH,
  cleanIdNumber,
  cleanLegalName,
  BUYER_ID_BUCKET,
  idCountry,
  mayContactDojah,
} from "@/lib/id-verification";
import { matchName, recordFullName } from "@/lib/name-match";
import { evaluateReferralQualification } from "@/lib/referral-credit";
import { notifyBuyerIdReview } from "@/lib/notifications";
import { SESSION_ENDED, notSaved, saved, type ActionResult } from "@/lib/action-result";

/**
 * The buyer's ID step (lib/id-verification.ts). Writes go through the
 * service role: buyers can't set their own id_* / verification fields (the
 * buyer_profiles guard, migration 0058). Every write is read back.
 */

async function currentBuyer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: account } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (account?.role !== "buyer") return null;
  return user;
}

/** Deletes a buyer's earlier ID photo once it's been replaced (ID photos never linger). */
async function removeEarlierPhoto(
  admin: ReturnType<typeof createAdminClient>,
  earlierPath: string | null | undefined,
  keepPath: string | null,
) {
  if (!earlierPath || earlierPath === keepPath) return;
  const { error } = await admin.storage.from(BUYER_ID_BUCKET).remove([earlierPath]);
  if (error) console.error("earlier buyer ID photo delete failed:", error);
}

async function earlierPhotoPath(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data } = await admin.from("buyer_profiles").select("id_document_path").eq("user_id", userId).maybeSingle();
  return data?.id_document_path ?? null;
}

const NAME_HELP = "enter your full legal name exactly as it appears on your ID (first and last name).";

/** Nigeria (NIN) and Ghana (Ghana Card), checked through Dojah. */
export async function verifyBuyerId(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await currentBuyer();
  if (!user) return notSaved(SESSION_ENDED);

  const country = idCountry(formData.get("country"));
  if (!country) return notSaved("choose your country.");
  if (country.method === "document") return notSaved("for Togo and Benin, upload a photo of your ID instead.");
  const method = country.method;

  const legalName = cleanLegalName(formData.get("legal_name"));
  if (!legalName) return notSaved(NAME_HELP);
  const idNumber = cleanIdNumber(method, formData.get("id_number"));
  if (!idNumber) {
    return notSaved(method === "ng_nin" ? "enter your 11-digit NIN." : "enter your Ghana Card number, like GHA-123456789-0.");
  }

  // Never send a real ID number to Dojah's sandbox.
  if (!mayContactDojah(method, idNumber)) return { ok: false, message: ID_CHECK_OPENS_AT_LAUNCH };

  const allowed = await checkRateLimit(`kyc:${user.id}`, 5, 60 * 60);
  if (!allowed) return { ok: false, message: RATE_LIMIT_MESSAGE };

  let result;
  try {
    result = method === "ng_nin" ? await lookupNin(idNumber) : await lookupGhanaCard(idNumber);
  } catch (err) {
    console.error(`Dojah ${method} lookup failed:`, err);
    return notSaved("we couldn't reach the verification service. Try again in a minute.");
  }

  const admin = createAdminClient();
  if (result.status !== "verified") {
    if (method === "ng_nin") {
      await admin.from("buyer_profiles").update({ nin_verification_status: "failed" }).eq("user_id", user.id);
    }
    return notSaved(
      method === "ng_nin"
        ? "we couldn't find that NIN. Check the number and try again."
        : "we couldn't find that Ghana Card. Check the number and try again.",
    );
  }

  const earlier = await earlierPhotoPath(admin, user.id);
  const match = matchName(legalName, result);
  const autoVerified = match === "match" || match === "close";
  const now = new Date().toISOString();

  const res = await admin
    .from("buyer_profiles")
    .update({
      verification_status: autoVerified ? "verified" : "pending",
      ...(method === "ng_nin" ? { nin_verification_status: autoVerified ? "verified" : "pending" } : {}),
      id_country: country.code,
      id_method: method,
      id_legal_name: legalName,
      id_name_match: match,
      // Kept only when a person has to compare it; never the ID number.
      id_record_name: autoVerified ? null : recordFullName(result),
      id_document_type: null,
      id_document_path: null,
      id_review_note: null,
      id_verified_at: autoVerified ? now : null,
      country: country.code,
      full_name: legalName,
    })
    .eq("user_id", user.id)
    .select("verification_status");
  if (res.error) return notSaved(res.error.message);
  const status = res.data?.[0]?.verification_status;
  if (status !== (autoVerified ? "verified" : "pending")) return notSaved("your ID result couldn't be saved. Try again.");

  await removeEarlierPhoto(admin, earlier, null);
  revalidatePath("/buyer/verify-id");
  revalidatePath("/buyer/dashboard");

  if (!autoVerified) {
    await notifyBuyerIdReview(user.id, `${country.idLabel} found, but the name typed doesn't match the record`);
    return saved(
      "Thanks — your ID was found, but the name doesn't exactly match the record, so ShipMova will check it. We'll email you when it's done.",
    );
  }

  // Referral credit waits on a verified ID (lib/referral-credit.ts).
  const { data: paidRequest } = await admin
    .from("purchase_requests")
    .select("id")
    .eq("buyer_id", user.id)
    .eq("mova_fee_payment_status", "paid")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (paidRequest) {
    await evaluateReferralQualification(admin, { referredUserId: user.id, purchaseRequestId: paidRequest.id });
  }
  return saved("You're verified. Welcome to ShipMova.");
}

/**
 * Togo and Benin: the photo is already in the private buyer-id-documents
 * bucket (uploaded from the browser into the buyer's own folder); this
 * records it for the founder's review.
 */
export async function submitIdDocument(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await currentBuyer();
  if (!user) return notSaved(SESSION_ENDED);

  const country = idCountry(formData.get("country"));
  if (!country || country.method !== "document") return notSaved("choose Togo or Benin.");
  const legalName = cleanLegalName(formData.get("legal_name"));
  if (!legalName) return notSaved(NAME_HELP);
  const documentType = formData.get("document_type");
  if (documentType !== "national_id" && documentType !== "passport") return notSaved("choose national ID or passport.");
  const path = formData.get("document_path");
  if (typeof path !== "string" || !path.startsWith(`${user.id}/`)) return notSaved("upload a photo of your ID first.");

  const admin = createAdminClient();
  const earlier = await earlierPhotoPath(admin, user.id);
  const res = await admin
    .from("buyer_profiles")
    .update({
      verification_status: "pending",
      id_country: country.code,
      id_method: "document",
      id_legal_name: legalName,
      id_name_match: null,
      id_record_name: null,
      id_document_type: documentType,
      id_document_path: path,
      id_review_note: null,
      id_verified_at: null,
      country: country.code,
      full_name: legalName,
    })
    .eq("user_id", user.id)
    .select("verification_status, id_document_path");
  if (res.error) return notSaved(res.error.message);
  if (res.data?.[0]?.id_document_path !== path) return notSaved("your ID photo couldn't be recorded. Try again.");

  await removeEarlierPhoto(admin, earlier, path);
  revalidatePath("/buyer/verify-id");
  await notifyBuyerIdReview(user.id, `${country.name} ${documentType === "passport" ? "passport" : "national ID"} photo to check`);
  return saved("Thanks — ShipMova will check your ID, usually within a day. We'll email you when it's done.");
}
