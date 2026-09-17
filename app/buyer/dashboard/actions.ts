"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_POLICY_VERSION } from "@/lib/policy";

export type AcceptFeePaymentPolicyResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Buyer's "I understand and agree" acceptance on the fee-payment (Invoice 1)
 * step, just before they're sent to the pre-built Stripe Checkout link. A
 * separate acceptance from the signup-time one — this one is tied to the
 * specific reservation/fee they're about to pay, so it's its own
 * policy_acceptances row (context = 'fee_payment') rather than overwriting
 * anything on buyer_profiles.
 *
 * ip_address/user_agent are read from the request itself, never trusted from
 * the client. accepted_at and role are likewise forced server-side by the
 * policy_acceptances_guard trigger (migration 0013) regardless of what's
 * sent here — this function doesn't need to (and doesn't) set them.
 */
export async function acceptFeePaymentPolicy(
  purchaseRequestId: string,
): Promise<AcceptFeePaymentPolicyResult> {
  if (typeof purchaseRequestId !== "string" || purchaseRequestId.length === 0) {
    return { ok: false, error: "Something went wrong. Please reload and try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Please sign in and try again." };
  }

  // Ownership is also enforced by the "policy acceptances self insert" RLS
  // policy (it checks purchase_requests.buyer_id = auth.uid() itself); this
  // is just the friendly error path.
  const { data: pr } = await supabase
    .from("purchase_requests")
    .select("id, buyer_id, mova_fee_checkout_url")
    .eq("id", purchaseRequestId)
    .maybeSingle();
  if (!pr || pr.buyer_id !== user.id) {
    return { ok: false, error: "This reservation isn't available." };
  }
  if (!pr.mova_fee_checkout_url) {
    return { ok: false, error: "There's no payment link ready for this reservation yet." };
  }

  const h = await headers();
  const ipAddress =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  const userAgent = h.get("user-agent");

  const { error } = await supabase.from("policy_acceptances").insert({
    user_id: user.id,
    context: "fee_payment",
    policy_version: CURRENT_POLICY_VERSION,
    purchase_request_id: purchaseRequestId,
    ip_address: ipAddress,
    user_agent: userAgent,
  });
  if (error) {
    console.error("acceptFeePaymentPolicy: insert failed", error);
    return { ok: false, error: "Couldn't record your agreement. Please try again." };
  }

  return { ok: true };
}

export type SubmitBankTransferProofResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Records a bank-transfer proof upload (components/ui/bank-transfer-payment.tsx
 * has already put the file at bank-transfer-proofs/<uid>/<purchaseRequestId>/…,
 * enforced by that bucket's own storage RLS) onto the reservation.
 *
 * This can only ever move mova_fee_payment_status to
 * 'pending_manual_verification' — never 'paid'. That's enforced at the
 * database by purchase_requests_guard_negotiation (migration 0014), not by
 * this function; a buyer hitting the table directly (bypassing this action
 * entirely) is blocked the same way.
 */
export async function submitBankTransferProof(
  purchaseRequestId: string,
  proofPath: string,
): Promise<SubmitBankTransferProofResult> {
  if (typeof purchaseRequestId !== "string" || purchaseRequestId.length === 0) {
    return { ok: false, error: "Something went wrong. Please reload and try again." };
  }
  if (typeof proofPath !== "string" || proofPath.length === 0) {
    return { ok: false, error: "Upload didn't complete. Please try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Please sign in and try again." };
  }

  const { data: pr } = await supabase
    .from("purchase_requests")
    .select("id, buyer_id, mova_fee_payment_status")
    .eq("id", purchaseRequestId)
    .maybeSingle();
  if (!pr || pr.buyer_id !== user.id) {
    return { ok: false, error: "This reservation isn't available." };
  }
  if (
    pr.mova_fee_payment_status !== "pending" &&
    pr.mova_fee_payment_status !== "bank_transfer_rejected"
  ) {
    return {
      ok: false,
      error: "This reservation's fee payment isn't awaiting a bank transfer right now.",
    };
  }

  // Sanity-check the path actually belongs to this buyer/reservation before
  // trusting it in the row update — the real boundary is the storage
  // bucket's own RLS policy, which already refused the upload otherwise.
  const expectedPrefix = `${user.id}/${purchaseRequestId}/`;
  if (!proofPath.startsWith(expectedPrefix)) {
    return { ok: false, error: "Upload didn't complete. Please try again." };
  }

  const { error } = await supabase
    .from("purchase_requests")
    .update({
      payment_method: "bank_transfer",
      mova_fee_payment_status: "pending_manual_verification",
      bank_transfer_proof_path: proofPath,
    })
    .eq("id", purchaseRequestId);
  if (error) {
    console.error("submitBankTransferProof: update failed", error);
    return { ok: false, error: "Couldn't record your transfer. Please try again." };
  }

  revalidatePath("/buyer/dashboard");
  return { ok: true };
}
