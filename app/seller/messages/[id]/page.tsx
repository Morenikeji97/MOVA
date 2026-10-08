import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatThread, type ChatMessage } from "@/components/ui/chat-thread";
import { NegotiatePricePanel } from "@/components/ui/negotiate-price-panel";
import { BuyerIdSummary } from "@/components/buyer-id-summary";
import { BackLink, DashboardShell } from "@/components/ui/dashboard";

export default async function SellerConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS confines this to the seller's own conversations.
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, vehicle_id, buyer_id, seller_id")
    .eq("id", id)
    .maybeSingle();

  if (!conversation || conversation.seller_id !== user!.id) notFound();

  const [{ data: vehicle }, { data: buyer }, { data: messageRows }, { data: pr }, { data: buyerId }] =
    await Promise.all([
      supabase
        .from("vehicles")
        .select("id, year, make, model, trim, price_usd")
        .eq("id", conversation.vehicle_id)
        .maybeSingle(),
      supabase
        .from("users")
        .select("id, email")
        .eq("id", conversation.buyer_id)
        .maybeSingle(),
      supabase
        .from("messages")
        .select("id, sender_id, content, created_at")
        .eq("conversation_id", id)
        .eq("blocked_attempt", false)
        .order("created_at", { ascending: true }),
      // The buyer's current open reservation on this vehicle, if any — drives
      // the "propose a price" panel below.
      supabase
        .from("purchase_requests")
        .select("id, vehicle_price_usd, negotiated_price_usd, negotiated_price_status")
        .eq("vehicle_id", conversation.vehicle_id)
        .eq("buyer_id", conversation.buyer_id)
        .not("status", "in", "(cancelled,rejected,completed)")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.rpc("buyer_id_summary", { p_buyer_id: conversation.buyer_id }),
    ]);

  const title = vehicle
    ? `${vehicle.year} ${vehicle.make} ${vehicle.model}${
        vehicle.trim ? ` ${vehicle.trim}` : ""
      }`
    : "Vehicle no longer listed";
  const buyerLabel = buyer?.email ?? "Buyer";

  return (
    <DashboardShell narrow>
      <BackLink href="/seller/messages">All messages</BackLink>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="min-w-0 break-words font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          {title}
        </h1>
        {vehicle ? (
          <Link
            href={`/browse/${vehicle.id}`}
            className="inline-flex h-11 items-center text-sm font-semibold text-ink underline underline-offset-2"
          >
            View listing &rarr;
          </Link>
        ) : null}
      </div>
      <p className="mt-1 break-all text-sm text-muted">Conversation with {buyerLabel}</p>
      <BuyerIdSummary summary={buyerId ?? null} />

      {pr && vehicle ? (
        <NegotiatePricePanel
          conversationId={conversation.id}
          listingPriceUsd={Number(vehicle.price_usd)}
          negotiatedPriceUsd={
            pr.negotiated_price_usd != null ? Number(pr.negotiated_price_usd) : null
          }
          negotiatedPriceStatus={pr.negotiated_price_status}
        />
      ) : null}

      <div className="mt-6">
        <ChatThread
          conversationId={conversation.id}
          selfId={user!.id}
          counterpartyLabel={buyerLabel}
          initialMessages={(messageRows ?? []) as ChatMessage[]}
          emptyHint={`No messages yet. ${buyerLabel} will see your reply here.`}
        />
      </div>
    </DashboardShell>
  );
}

export const dynamic = "force-dynamic";
