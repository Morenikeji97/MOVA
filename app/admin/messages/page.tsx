import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const stamp = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const MAX_ROWS = 250;

/**
 * Read-only monitoring of contact-info blocks across every conversation. Not
 * linked from the buyer/seller UI. Blocked messages are stored (content
 * included) but hidden from participants by RLS; admins see them here to catch
 * repeat circumvention attempts.
 */
export default async function AdminBlockedMessagesPage() {
  const supabase = await createClient();

  const { data: blockedRows } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, content, created_at")
    .eq("blocked_attempt", true)
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  const blocked = blockedRows ?? [];
  const conversationIds = [...new Set(blocked.map((m) => m.conversation_id))];

  const { data: conversationRows } = conversationIds.length
    ? await supabase
        .from("conversations")
        .select("id, vehicle_id, buyer_id, seller_id")
        .in("id", conversationIds)
    : { data: [] };

  const conversationById = new Map(
    (conversationRows ?? []).map((c) => [c.id, c]),
  );

  const vehicleIds = [
    ...new Set((conversationRows ?? []).map((c) => c.vehicle_id)),
  ];
  const userIds = [
    ...new Set([
      ...blocked.map((m) => m.sender_id),
      ...(conversationRows ?? []).flatMap((c) => [c.buyer_id, c.seller_id]),
    ]),
  ];

  const [vehiclesRes, usersRes] = await Promise.all([
    vehicleIds.length
      ? supabase
          .from("vehicles")
          .select("id, year, make, model, trim")
          .in("id", vehicleIds)
      : null,
    userIds.length
      ? supabase.from("users").select("id, email").in("id", userIds)
      : null,
  ]);

  const vehicleById = new Map((vehiclesRes?.data ?? []).map((v) => [v.id, v]));
  const emailById = new Map(
    (usersRes?.data ?? []).map((u) => [u.id, u.email]),
  );

  // Repeat-offender roll-up.
  const countBySender = new Map<string, number>();
  for (const m of blocked) {
    countBySender.set(m.sender_id, (countBySender.get(m.sender_id) ?? 0) + 1);
  }
  const repeatOffenders = [...countBySender.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link
        href="/admin/dashboard"
        className="font-mono text-xs uppercase tracking-wider text-ink-400 hover:text-ink-900"
      >
        &larr; Admin dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-ink-900">
        Blocked contact-info attempts
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        {blocked.length === 0
          ? "No blocked attempts recorded."
          : `${blocked.length} blocked message${
              blocked.length === 1 ? "" : "s"
            }${blocked.length === MAX_ROWS ? " (most recent)" : ""} across ${
              conversationIds.length
            } conversation${conversationIds.length === 1 ? "" : "s"}.`}
      </p>

      {repeatOffenders.length > 0 ? (
        <div className="mt-6 rounded-lg border border-copper-100 bg-copper-50 p-4">
          <p className="font-mono text-xs uppercase tracking-wider text-copper-700">
            Repeat attempts
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-copper-700">
            {repeatOffenders.map(([senderId, n]) => (
              <li key={senderId}>
                {emailById.get(senderId) ?? senderId} — {n} attempts
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {blocked.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-paper-200 bg-paper-100 p-10 text-center">
          <p className="text-ink-900">Nothing flagged.</p>
          <p className="mt-1 text-sm text-slate-500">
            Messages that trip the contact-info filter will appear here.
          </p>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {blocked.map((m) => {
            const convo = conversationById.get(m.conversation_id);
            const vehicle = convo
              ? vehicleById.get(convo.vehicle_id)
              : undefined;
            const title = vehicle
              ? `${vehicle.year} ${vehicle.make} ${vehicle.model}${
                  vehicle.trim ? ` ${vehicle.trim}` : ""
                }`
              : "Vehicle unavailable";
            const senderEmail = emailById.get(m.sender_id) ?? m.sender_id;
            const role =
              convo && m.sender_id === convo.buyer_id
                ? "buyer"
                : convo && m.sender_id === convo.seller_id
                  ? "seller"
                  : "unknown";

            return (
              <li
                key={m.id}
                className="rounded-lg border border-paper-200 bg-paper-100 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">
                      {senderEmail}{" "}
                      <span className="font-normal text-ink-400">({role})</span>
                    </p>
                    <p className="mt-0.5 font-mono text-xs uppercase tracking-wider text-ink-400">
                      {title}
                      {convo
                        ? ` · buyer ${emailById.get(convo.buyer_id) ?? "—"} · seller ${
                            emailById.get(convo.seller_id) ?? "—"
                          }`
                        : ""}
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-ink-400">
                    {stamp.format(new Date(m.created_at))}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words rounded border border-paper-200 bg-paper p-3 text-sm text-slate-500">
                  {m.content}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

export const dynamic = "force-dynamic";
