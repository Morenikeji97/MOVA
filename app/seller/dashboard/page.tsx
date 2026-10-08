import { createClient } from "@/lib/supabase/server";
import { DashboardHeader, DashboardShell, DashboardTile, StatusPill } from "@/components/ui/dashboard";
import { SellerReviewHub } from "@/components/reviews/seller-review-hub";
import { ReferralPanel } from "@/components/ui/referral-panel";
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

  const { count: listingCount } = await supabase
    .from("vehicles")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", user!.id);

  return (
    <DashboardShell>
      <DashboardHeader eyebrow="Seller" title="Your dashboard" intro={`Signed in as ${user?.email ?? ""}`} />

      <nav aria-label="Seller areas" className="mt-6 grid gap-3 sm:grid-cols-3">
        <DashboardTile
          href="/seller/listings"
          title="My listings"
          body={listingCount ? `${listingCount} listing${listingCount === 1 ? "" : "s"}` : "Add your first car"}
        />
        <DashboardTile href="/seller/reservations" title="Reservations" body="Buyers who reserved your cars" />
        <DashboardTile
          href="/seller/messages"
          title="Messages"
          body="Questions from buyers"
          badge={unreadMessages > 0 ? <StatusPill tone="warning">{unreadMessages} new</StatusPill> : null}
        />
      </nav>

      <VerificationPanel
        status={profile?.id_verification_status ?? null}
        verifiedAt={profile?.id_verified_at ?? null}
        notice={notice}
      />

      <SellerReviewHub userId={user!.id} />

      <ReferralPanel userId={user!.id} />
    </DashboardShell>
  );
}
