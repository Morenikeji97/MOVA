import { createClient } from "@/lib/supabase/server";
import { buttonClasses } from "@/components/ui/button";
import { markReferralFlagReviewed, updateReferralPayoutStatus } from "./actions";

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US");
}

export default async function AdminReferralsPage() {
  const supabase = await createClient();

  const [{ data: flagged }, { data: pendingBatches }] = await Promise.all([
    supabase
      .from("referral_credits")
      .select(
        "id, referrer_id, referred_id, role, created_at, email_pattern_match, phone_match, payment_fingerprint_match, device_fingerprint_match, ip_subnet_match",
      )
      .eq("flag_status", "flagged")
      .is("flag_reviewed_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("referral_payout_batches")
      .select("id, referrer_id, role, batch_number, amount_usd, method, status, created_at")
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: true }),
  ]);

  const userIds = Array.from(
    new Set([
      ...(flagged ?? []).flatMap((r) => [r.referrer_id, r.referred_id]),
      ...(pendingBatches ?? []).map((b) => b.referrer_id),
    ]),
  );
  const { data: userRows } =
    userIds.length > 0
      ? await supabase.from("users").select("id, email").in("id", userIds)
      : { data: [] };
  const emailById = new Map((userRows ?? []).map((u) => [u.id, u.email]));

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-black">Referral program</h1>
      <p className="mt-2 text-sm text-gray-500">
        Rate-flagged referrals (more than 5 qualifying credits for one
        referrer within 24 hours) and payout batches awaiting confirmation.
      </p>

      <section className="mt-10">
        <h2 className="font-mono text-xs uppercase tracking-wider text-gray-500">
          Flagged for review ({(flagged ?? []).length})
        </h2>
        {(flagged ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">Nothing flagged right now.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {(flagged ?? []).map((r) => {
              const signals = [
                r.email_pattern_match && "email pattern",
                r.phone_match && "phone",
                r.payment_fingerprint_match && "payment fingerprint",
                r.device_fingerprint_match && "device",
                r.ip_subnet_match && "IP subnet",
              ].filter(Boolean) as string[];
              return (
                <li
                  key={r.id}
                  className="rounded-lg border border-copper-100 bg-copper-50 p-4"
                >
                  <p className="text-sm text-black">
                    <strong>{emailById.get(r.referrer_id) ?? r.referrer_id}</strong> referred{" "}
                    <strong>{emailById.get(r.referred_id) ?? r.referred_id}</strong> ({r.role})
                  </p>
                  <p className="mt-1 font-mono text-xs text-gray-500">
                    {fmtDate(r.created_at)} — flagged for referral volume (&gt;5 in 24h), not
                    identity-signal matches
                    {signals.length > 0 ? ` (also logged: ${signals.join(", ")})` : ""}
                  </p>
                  <form action={markReferralFlagReviewed} className="mt-3">
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className={buttonClasses({ size: "sm", variant: "secondary" })}>
                      Mark reviewed
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-xs uppercase tracking-wider text-gray-500">
          Payouts awaiting confirmation ({(pendingBatches ?? []).length})
        </h2>
        {(pendingBatches ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No payouts pending.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {(pendingBatches ?? []).map((b) => (
              <li key={b.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="text-sm text-black">
                  <strong>{emailById.get(b.referrer_id) ?? b.referrer_id}</strong> — batch #
                  {b.batch_number} ({b.role}) — ${Number(b.amount_usd).toLocaleString()} via{" "}
                  {b.method === "stripe_transfer" ? "Stripe transfer" : "bank transfer"}
                </p>
                <p className="mt-1 font-mono text-xs text-gray-500">
                  Opened {fmtDate(b.created_at)} — status: {b.status}
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  Move the ${Number(b.amount_usd).toLocaleString()} yourself (
                  {b.method === "stripe_transfer" ? "Stripe Dashboard transfer" : "bank wire"}),
                  then record the outcome below.
                </p>
                <form action={updateReferralPayoutStatus} className="mt-3 flex flex-wrap items-end gap-3">
                  <input type="hidden" name="id" value={b.id} />
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500">Reference (optional)</span>
                    <input
                      name="payout_reference"
                      placeholder="tr_… / wire ref"
                      className="h-9 rounded border border-gray-200 px-2 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500">Failure reason (if failing)</span>
                    <input
                      name="failure_reason"
                      placeholder="e.g. no bank details on file"
                      className="h-9 rounded border border-gray-200 px-2 text-sm"
                    />
                  </label>
                  <button
                    type="submit"
                    name="status"
                    value="paid"
                    className={buttonClasses({ size: "sm" })}
                  >
                    Mark paid
                  </button>
                  <button
                    type="submit"
                    name="status"
                    value="failed"
                    className={buttonClasses({ size: "sm", variant: "secondary" })}
                  >
                    Mark failed
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
