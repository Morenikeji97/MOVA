"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scanForContactInfo, CONTACT_INFO_BLOCK_MESSAGE } from "@/lib/chat-filter";

/** Longest a single chat message may be. */
const MAX_MESSAGE_LENGTH = 4000;

export type OpenConversationResult =
  | { ok: true; conversationId: string }
  | { ok: false; error: string };

export type SendMessageResult =
  | { ok: true }
  | { ok: false; blocked: true; reason: string }
  | { ok: false; error: string };

/**
 * Buyer taps "Message seller" on /browse/[id]. Returns the existing
 * conversation for this (vehicle, buyer) pair or creates it. No reservation is
 * required — any approved listing can be messaged.
 */
export async function openConversation(
  vehicleId: string,
): Promise<OpenConversationResult> {
  if (typeof vehicleId !== "string" || vehicleId.length === 0) {
    return { ok: false, error: "Something went wrong. Please reload and try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Please sign in with a buyer account to message the seller." };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "buyer") {
    return { ok: false, error: "Messaging the seller is for buyer accounts." };
  }

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, seller_id, status")
    .eq("id", vehicleId)
    .eq("status", "approved")
    .maybeSingle();
  if (!vehicle) {
    return { ok: false, error: "This vehicle is no longer available." };
  }
  if (vehicle.seller_id === user.id) {
    return { ok: false, error: "This is your own listing." };
  }

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("vehicle_id", vehicleId)
    .eq("buyer_id", user.id)
    .maybeSingle();
  if (existing) return { ok: true, conversationId: existing.id };

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({
      vehicle_id: vehicleId,
      buyer_id: user.id,
      seller_id: vehicle.seller_id,
    })
    .select("id")
    .single();

  if (error || !created) {
    // Lost a race with another tab? The unique (vehicle_id, buyer_id) index
    // would have rejected the second insert — re-read before giving up.
    const { data: retry } = await supabase
      .from("conversations")
      .select("id")
      .eq("vehicle_id", vehicleId)
      .eq("buyer_id", user.id)
      .maybeSingle();
    if (retry) return { ok: true, conversationId: retry.id };

    console.error("openConversation: insert failed", error);
    return { ok: false, error: "We couldn't start this conversation just now. Please try again." };
  }

  revalidatePath("/seller/messages");
  return { ok: true, conversationId: created.id };
}

/** Resolve the conversation and confirm the signed-in user is in it. */
async function loadParticipantConversation(conversationId: string) {
  if (typeof conversationId !== "string" || conversationId.length === 0) {
    return null;
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, buyer_id, seller_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (
    !conversation ||
    (conversation.buyer_id !== user.id && conversation.seller_id !== user.id)
  ) {
    return null;
  }
  return { user, conversation };
}

/**
 * Send a chat message. Either participant may call it.
 *
 * The contact-info filter (lib/chat-filter.ts) is the authority here: a message
 * that trips it is stored as `blocked_attempt` for admin monitoring, is NEVER
 * delivered, and the caller gets {@link CONTACT_INFO_BLOCK_MESSAGE} back. All
 * writes use the service role, so this is the only way a `messages` row is
 * created and the filter can't be sidestepped by a hand-rolled client.
 */
export async function sendChatMessage(
  conversationId: string,
  content: string,
): Promise<SendMessageResult> {
  const text = typeof content === "string" ? content.trim() : "";
  if (!text) return { ok: false, error: "Type a message first." };
  if (text.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: `Keep messages under ${MAX_MESSAGE_LENGTH} characters.` };
  }

  const ctx = await loadParticipantConversation(conversationId);
  if (!ctx) return { ok: false, error: "This conversation isn't available." };

  const { user, conversation } = ctx;
  const admin = createAdminClient();
  const scan = scanForContactInfo(text);

  if (!scan.ok) {
    // Logged (content included) for admin visibility into repeat attempts;
    // RLS keeps this row invisible to both participants.
    const { error } = await admin.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: user.id,
      content: text,
      blocked_attempt: true,
    });
    if (error) console.error("sendChatMessage: blocked-attempt log failed", error);
    revalidatePath("/admin/messages");
    return {
      ok: false,
      blocked: true,
      reason: scan.message ?? CONTACT_INFO_BLOCK_MESSAGE,
    };
  }

  const { error } = await admin.from("messages").insert({
    conversation_id: conversation.id,
    sender_id: user.id,
    content: text,
    blocked_attempt: false,
  });
  if (error) {
    console.error("sendChatMessage: insert failed", error);
    return { ok: false, error: "Your message didn't send. Please try again." };
  }

  // The sender has, by definition, seen everything up to their own message.
  const nowIso = new Date().toISOString();
  await admin
    .from("conversations")
    .update(
      conversation.buyer_id === user.id
        ? { buyer_last_read_at: nowIso }
        : { seller_last_read_at: nowIso },
    )
    .eq("id", conversation.id);

  revalidatePath("/seller/messages");
  revalidatePath(`/seller/messages/${conversation.id}`);
  return { ok: true };
}

/** Move the caller's read cursor on this conversation to now. */
export async function markConversationRead(
  conversationId: string,
): Promise<void> {
  const ctx = await loadParticipantConversation(conversationId);
  if (!ctx) return;

  const { user, conversation } = ctx;
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  await admin
    .from("conversations")
    .update(
      conversation.buyer_id === user.id
        ? { buyer_last_read_at: nowIso }
        : { seller_last_read_at: nowIso },
    )
    .eq("id", conversation.id);

  revalidatePath("/seller/messages");
}

export type NegotiatePriceResult = { ok: true } | { ok: false; error: string };

/**
 * Seller proposes (or revises) a negotiated price on the buyer's open
 * reservation for this conversation's vehicle. Lower-only against the
 * reservation's price snapshot — this is just the fast, friendly error path;
 * the actual enforcement is the purchase_requests_guard_negotiation() trigger
 * (migration 0011), which reverts anything this check might miss or that a
 * caller bypassing the app tries directly.
 */
export async function proposeNegotiatedPrice(
  conversationId: string,
  priceUsd: number,
): Promise<NegotiatePriceResult> {
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
    return { ok: false, error: "Enter a valid price." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, vehicle_id, buyer_id, seller_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conversation || conversation.seller_id !== user.id) {
    return { ok: false, error: "This conversation isn't available." };
  }

  // The buyer's current open reservation on this vehicle — negotiation only
  // makes sense against a live reservation, not a cancelled/rejected/past one.
  const { data: pr } = await supabase
    .from("purchase_requests")
    .select("id, vehicle_price_usd, negotiated_price_status")
    .eq("vehicle_id", conversation.vehicle_id)
    .eq("buyer_id", conversation.buyer_id)
    .not("status", "in", "(cancelled,rejected,completed)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!pr) {
    return {
      ok: false,
      error: "This buyer doesn't have an open reservation on this vehicle.",
    };
  }
  if (pr.negotiated_price_status === "accepted") {
    return {
      ok: false,
      error: "The buyer already accepted a price on this reservation.",
    };
  }

  let ceiling = pr.vehicle_price_usd != null ? Number(pr.vehicle_price_usd) : null;
  if (ceiling == null) {
    const { data: vehicle } = await supabase
      .from("vehicles")
      .select("price_usd")
      .eq("id", conversation.vehicle_id)
      .maybeSingle();
    ceiling = vehicle ? Number(vehicle.price_usd) : null;
  }
  if (ceiling != null && priceUsd >= ceiling) {
    return {
      ok: false,
      error: `Must be lower than the listing price ($${ceiling.toLocaleString()}).`,
    };
  }

  const { error } = await supabase
    .from("purchase_requests")
    .update({
      negotiated_price_usd: priceUsd,
      negotiated_price_status: "proposed",
    })
    .eq("id", pr.id);
  if (error) {
    console.error("proposeNegotiatedPrice: update failed", error);
    return { ok: false, error: "Couldn't send that price. Please try again." };
  }

  revalidatePath(`/seller/messages/${conversationId}`);
  revalidatePath("/buyer/dashboard");
  revalidatePath(`/browse/${conversation.vehicle_id}`);
  return { ok: true };
}

/**
 * Buyer accepts the seller's currently-proposed price on one of their own
 * reservations. RLS ("purchase requests buyer accept price") plus the guard
 * trigger are what actually stop an accept without a prior proposal or on
 * someone else's reservation — this mirrors those checks for a clean error.
 */
export async function acceptNegotiatedPrice(
  purchaseRequestId: string,
): Promise<NegotiatePriceResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const { data: pr } = await supabase
    .from("purchase_requests")
    .select("id, vehicle_id, buyer_id, negotiated_price_status")
    .eq("id", purchaseRequestId)
    .maybeSingle();
  if (!pr || pr.buyer_id !== user.id) {
    return { ok: false, error: "This reservation isn't available." };
  }
  if (pr.negotiated_price_status !== "proposed") {
    return { ok: false, error: "There's no price offer to accept right now." };
  }

  const { error } = await supabase
    .from("purchase_requests")
    .update({ negotiated_price_status: "accepted" })
    .eq("id", pr.id);
  if (error) {
    console.error("acceptNegotiatedPrice: update failed", error);
    return { ok: false, error: "Couldn't accept that price. Please try again." };
  }

  revalidatePath("/buyer/dashboard");
  revalidatePath(`/browse/${pr.vehicle_id}`);
  revalidatePath("/admin/reservations");
  return { ok: true };
}
