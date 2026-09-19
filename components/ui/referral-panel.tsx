import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/app-url";
import { buttonClasses } from "@/components/ui/button";
import { CopyLinkButton } from "@/components/ui/copy-link-button";
import { buildReferralLink, REFERRAL_BATCH_SIZE, REFERRAL_PAYOUT_AMOUNT_USD } from "@/lib/referrals";

/**
 * Shown on both the Buyer and Seller dashboards. Reads the signed-in user's
 * own referral_code/referral_credits/referral_payout_batches rows — RLS
 * ("referral credits self or admin read" / "referral payout batches self or
 * admin read", migration 0030) already confines every query here to the
 * caller's own rows, so no extra ownership check is needed beyond passing
 * the caller's own userId in.
 */
export async function ReferralPanel({ userId }: { userId: string }) {
  const supabase = await createClient();

  const { data: user } = await supabase
    .from("users")
    .select("referral_code")
    .eq("id", userId)
    .maybeSingle();
  if (!user) return null;

  const [origin, { count: qualifyingCount }, { data: paidBatches }] = await Promise.all([
    appUrl(),
    supabase
      .from("referral_credits")
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", userId),
    supabase
      .from("referral_payout_batches")
      .select("amount_usd")
      .eq("referrer_id", userId)
      .eq("status", "paid"),
  ]);

  const link = buildReferralLink(origin, user.referral_code);
  const qrDataUrl = await QRCode.toDataURL(link, { margin: 1, width: 240 });

  const count = qualifyingCount ?? 0;
  const progress = count % REFERRAL_BATCH_SIZE;
  const batchesPaid = (paidBatches ?? []).length;
  const lifetimeEarnedUsd = (paidBatches ?? []).reduce(
    (sum, b) => sum + Number(b.amount_usd),
    0,
  );

  return (
    <section className="mt-10 rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="font-mono text-xs uppercase tracking-wider text-gray-500">
        Referral program
      </h2>
      <p className="mt-2 text-sm text-gray-500">
        Earn ${REFERRAL_PAYOUT_AMOUNT_USD.toLocaleString()} for every{" "}
        {REFERRAL_BATCH_SIZE} people you refer who complete a transaction on MOVA.
      </p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, not an optimizable asset */}
        <img
          src={qrDataUrl}
          alt="QR code linking to your MOVA referral signup page"
          className="h-32 w-32 rounded border border-gray-200"
        />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs uppercase tracking-wider text-gray-500">
            Your referral code
          </p>
          <p className="text-lg font-semibold text-black">{user.referral_code}</p>
          <p className="mt-2 break-all text-sm text-gray-500">{link}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <CopyLinkButton link={link} />
            <a
              href={qrDataUrl}
              download="mova-referral-qr.png"
              className={buttonClasses({ size: "sm", variant: "secondary" })}
            >
              Download QR code
            </a>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-sm text-black">
          {progress} of {REFERRAL_BATCH_SIZE} toward your next $
          {REFERRAL_PAYOUT_AMOUNT_USD.toLocaleString()}
        </p>
        <div className="mt-1.5 h-2 w-full rounded-full bg-gray-100">
          <div
            className="h-2 rounded-full bg-black"
            style={{ width: `${(progress / REFERRAL_BATCH_SIZE) * 100}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Lifetime earned:{" "}
          <span className="font-semibold text-black">
            ${lifetimeEarnedUsd.toLocaleString()}
          </span>{" "}
          ({batchesPaid} {batchesPaid === 1 ? "payout" : "payouts"})
        </p>
      </div>
    </section>
  );
}
