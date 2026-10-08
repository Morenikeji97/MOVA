import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  scanForContactInfo,
  type ContactInfoCategory,
} from "@/lib/chat-filter";
import { BackLink, DashboardShell } from "@/components/ui/dashboard";

const CATEGORY_LABEL: Record<ContactInfoCategory, string> = {
  email: "email",
  phone: "phone",
  url: "link / domain",
  social_handle: "social handle",
  circumvention_phrase: "contact exchange",
  circumvention_intent: "off-platform intent",
  address: "meetup / address",
  payment_circumvention: "off-platform payment",
  evasion: "evasion attempt",
};

const STRUCTURAL_CATEGORIES: ContactInfoCategory[] = [
  "email",
  "phone",
  "url",
  "social_handle",
  "address",
  "circumvention_phrase",
];

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
    <DashboardShell>
      <BackLink href="/admin/dashboard">Admin dashboard</BackLink>
      <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-ink">
        Blocked contact-info attempts
      </h1>
      <p className="mt-2 text-sm text-muted">
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
        <div className="mt-10 rounded-lg border border-dashed border-line bg-white p-10 text-center">
          <p className="text-ink">Nothing flagged.</p>
          <p className="mt-1 text-sm text-muted">
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

            // Re-run the shared filter so admins see WHY each attempt was
            // blocked (the row itself only stores a boolean).
            const scan = scanForContactInfo(m.content);
            // Same priority as the message the sender saw (lib/chat-filter.ts).
            const payment = scan.categories.includes("payment_circumvention");
            const intentOnly =
              !payment &&
              scan.categories.length > 0 &&
              !scan.categories.some((c) => STRUCTURAL_CATEGORIES.includes(c));

            return (
              <li
                key={m.id}
                className="rounded-card border border-line bg-white shadow-card p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {senderEmail}{" "}
                      <span className="font-normal text-muted">({role})</span>
                    </p>
                    <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                      {title}
                      {convo
                        ? ` · buyer ${emailById.get(convo.buyer_id) ?? "—"} · seller ${
                            emailById.get(convo.seller_id) ?? "—"
                          }`
                        : ""}
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-muted">
                    {stamp.format(new Date(m.created_at))}
                  </span>
                </div>
                {scan.categories.length > 0 ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        payment || !intentOnly
                          ? "bg-copper-50 text-copper-700"
                          : "bg-marine-50 text-marine-700"
                      }`}
                    >
                      {payment
                        ? "Off-platform payment"
                        : intentOnly
                          ? "Off-platform intent"
                          : "Contact info"}
                    </span>
                    {scan.categories.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center rounded-full bg-band px-2 py-0.5 font-mono text-[11px] text-muted"
                      >
                        {CATEGORY_LABEL[c]}
                      </span>
                    ))}
                  </div>
                ) : null}
                <p className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-line bg-white p-3 text-sm text-muted">
                  {m.content}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardShell>
  );
}

export const dynamic = "force-dynamic";
