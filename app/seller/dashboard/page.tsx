import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonClasses } from "@/components/ui/button";
import { VerificationPanel } from "../verification/verification-panel";

export default async function SellerDashboard({
  searchParams,
}: {
  searchParams: Promise<{ verification?: string }>;
}) {
  const { verification } = await searchParams;
  const notice =
    verification === "complete"
      ? "complete"
      : verification === "error"
        ? "error"
        : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("seller_profiles")
    .select("*")
    .eq("user_id", user!.id)
    .single();

  const profile = data;

  // Unread buyer messages across all of this seller's conversations.
  const { data: convoRows } = await supabase
    .from("conversations")
    .select("id, seller_last_read_at")
    .eq("seller_id", user!.id);

  const convoList = convoRows ?? [];
  let unreadMessages = 0;
  if (convoList.length > 0) {
    const { data: msgRows } = await supabase
      .from("messages")
      .select("conversation_id, sender_id, created_at")
      .in(
        "conversation_id",
        convoList.map((c) => c.id),
      )
      .eq("blocked_attempt", false)
      .neq("sender_id", user!.id);
    const readCutoff = new Map(
      convoList.map((c) => [
        c.id,
        c.seller_last_read_at ? new Date(c.seller_last_read_at).getTime() : 0,
      ]),
    );
    unreadMessages = (msgRows ?? []).filter(
      (m) =>
        new Date(m.created_at).getTime() > (readCutoff.get(m.conversation_id) ?? 0),
    ).length;
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-ink-900">Seller Dashboard</h1>
      <p className="mt-2 text-slate-500">Signed in as {user?.email}</p>
      <p className="mt-1 font-mono text-sm text-ink-400">
        Verification status: {profile?.id_verification_status ?? "unverified"}
      </p>
      <div className="mt-8 flex flex-col items-start gap-3">
        <Link href="/seller/listings" className={buttonClasses({ size: "sm" })}>
          My listings
        </Link>
        <Link
          href="/seller/messages"
          className={buttonClasses({ size: "sm", variant: "secondary" })}
        >
          Messages
          {unreadMessages > 0 ? (
            <span className="ml-2 inline-flex items-center rounded-full bg-copper px-2 py-0.5 text-xs font-semibold text-white">
              {unreadMessages}
            </span>
          ) : null}
        </Link>
        <p className="text-sm text-slate-500">
          Photo upload and richer status tracking arrive later in Phase 1.
        </p>
      </div>

      <VerificationPanel
        status={profile?.id_verification_status ?? null}
        verifiedAt={profile?.id_verified_at ?? null}
        notice={notice}
      />
    </main>
  );
}
