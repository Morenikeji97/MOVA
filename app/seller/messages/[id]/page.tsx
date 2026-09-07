import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatThread, type ChatMessage } from "@/components/ui/chat-thread";

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

  const [{ data: vehicle }, { data: buyer }, { data: messageRows }] =
    await Promise.all([
      supabase
        .from("vehicles")
        .select("id, year, make, model, trim")
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
    ]);

  const title = vehicle
    ? `${vehicle.year} ${vehicle.make} ${vehicle.model}${
        vehicle.trim ? ` ${vehicle.trim}` : ""
      }`
    : "Vehicle no longer listed";
  const buyerLabel = buyer?.email ?? "Buyer";

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link
        href="/seller/messages"
        className="font-mono text-xs uppercase tracking-wider text-ink-400 hover:text-ink-900"
      >
        &larr; All messages
      </Link>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold text-ink-900">{title}</h1>
        {vehicle ? (
          <Link
            href={`/browse/${vehicle.id}`}
            className="text-sm text-marine-700 hover:underline"
          >
            View listing &rarr;
          </Link>
        ) : null}
      </div>
      <p className="mt-1 font-mono text-sm text-ink-400">
        Conversation with {buyerLabel}
      </p>

      <div className="mt-6">
        <ChatThread
          conversationId={conversation.id}
          selfId={user!.id}
          counterpartyLabel={buyerLabel}
          initialMessages={(messageRows ?? []) as ChatMessage[]}
          emptyHint={`No messages yet. ${buyerLabel} will see your reply here.`}
        />
      </div>
    </main>
  );
}

export const dynamic = "force-dynamic";
