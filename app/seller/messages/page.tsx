import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cardClasses } from "@/components/ui/card";
import { BackLink, DashboardShell, EmptyCard, StatusPill } from "@/components/ui/dashboard";

const stamp = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function SellerMessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: conversationRows } = await supabase
    .from("conversations")
    .select("id, vehicle_id, buyer_id, seller_last_read_at, created_at")
    .eq("seller_id", user!.id)
    .order("created_at", { ascending: false });

  const conversations = conversationRows ?? [];
  const conversationIds = conversations.map((c) => c.id);
  const vehicleIds = [...new Set(conversations.map((c) => c.vehicle_id))];
  const buyerIds = [...new Set(conversations.map((c) => c.buyer_id))];

  const [vehiclesRes, buyersRes, messagesRes] = await Promise.all([
    vehicleIds.length
      ? supabase
          .from("vehicles")
          .select("id, year, make, model, trim")
          .in("id", vehicleIds)
      : null,
    buyerIds.length
      ? supabase.from("users").select("id, email").in("id", buyerIds)
      : null,
    conversationIds.length
      ? supabase
          .from("messages")
          .select("conversation_id, sender_id, content, created_at")
          .in("conversation_id", conversationIds)
          .eq("blocked_attempt", false)
          .order("created_at", { ascending: true })
      : null,
  ]);

  const vehicleById = new Map((vehiclesRes?.data ?? []).map((v) => [v.id, v]));
  const buyerById = new Map((buyersRes?.data ?? []).map((b) => [b.id, b]));

  type Summary = {
    last: { content: string; created_at: string; fromSeller: boolean } | null;
    unread: number;
  };
  const summaryByConversation = new Map<string, Summary>();
  for (const m of messagesRes?.data ?? []) {
    const s = summaryByConversation.get(m.conversation_id) ?? {
      last: null,
      unread: 0,
    };
    s.last = {
      content: m.content,
      created_at: m.created_at,
      fromSeller: m.sender_id === user!.id,
    };
    summaryByConversation.set(m.conversation_id, s);
  }
  for (const c of conversations) {
    const s = summaryByConversation.get(c.id);
    if (!s) continue;
    const readCutoff = c.seller_last_read_at
      ? new Date(c.seller_last_read_at).getTime()
      : 0;
    s.unread = (messagesRes?.data ?? []).filter(
      (m) =>
        m.conversation_id === c.id &&
        m.sender_id !== user!.id &&
        new Date(m.created_at).getTime() > readCutoff,
    ).length;
  }

  const totalUnread = [...summaryByConversation.values()].reduce(
    (n, s) => n + s.unread,
    0,
  );

  return (
    <DashboardShell>
      <BackLink href="/seller/dashboard">Seller dashboard</BackLink>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Messages</h1>
      <p className="mt-2 text-sm text-muted">
        {conversations.length === 0
          ? "No buyer messages yet."
          : `${conversations.length} conversation${
              conversations.length === 1 ? "" : "s"
            }${totalUnread > 0 ? ` · ${totalUnread} unread` : ""}.`}
      </p>

      {conversations.length === 0 ? (
        <div className="mt-6">
          <EmptyCard title="Nothing here yet">
            When a buyer messages you from one of your listings, the conversation shows up here.
          </EmptyCard>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {conversations.map((c) => {
            const vehicle = vehicleById.get(c.vehicle_id);
            const buyer = buyerById.get(c.buyer_id);
            const summary = summaryByConversation.get(c.id);
            const title = vehicle
              ? `${vehicle.year} ${vehicle.make} ${vehicle.model}${
                  vehicle.trim ? ` ${vehicle.trim}` : ""
                }`
              : "Vehicle no longer listed";

            return (
              <li key={c.id}>
                <Link
                  href={`/seller/messages/${c.id}`}
                  className={cardClasses({ className: "block transition-colors hover:border-ink" })}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="truncate font-display text-lg font-bold text-ink">
                        {title}
                      </h2>
                      <p className="mt-1 truncate text-xs text-muted">
                        {buyer?.email ?? "Buyer"}
                      </p>
                    </div>
                    {summary && summary.unread > 0 ? (
                      <StatusPill tone="warning">{summary.unread} new</StatusPill>
                    ) : null}
                  </div>
                  {summary?.last ? (
                    <p className="mt-3 truncate text-sm text-muted">
                      <span>
                        {summary.last.fromSeller ? "You: " : ""}
                      </span>
                      {summary.last.content}
                      <span className="ml-2 text-xs tabular-nums text-muted">
                        {stamp.format(new Date(summary.last.created_at))}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-muted">No messages yet.</p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardShell>
  );
}

export const dynamic = "force-dynamic";
