import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/app-url";
import { buttonClasses } from "@/components/ui/button";
import { CopyLinkButton } from "@/components/ui/copy-link-button";
import { WhatsAppShareButton } from "@/components/ui/whatsapp-share-button";
import {
  buildReferralLink,
  REFERRAL_BATCH_SIZE,
  REFERRAL_CREDIT_AMOUNT_USD,
  REFERRAL_PAYOUT_AMOUNT_USD,
} from "@/lib/referrals";

const usd = (n: number) => `$${n.toLocaleString()}`;

/**
 * Shown at the top of every dashboard — Buyer, Seller, Shipper, Inspector.
 * Reads the signed-in user's own referral_code/referral_credits/
 * referral_payout_batches rows — RLS ("referral credits self or admin
 * read" / "referral payout batches self or admin read", migration 0030)
 * already confines every query here to the caller's own rows, so no extra
 * ownership check is needed beyond passing the caller's own userId in.
 * Works unmodified for a Shipper or Inspector referrer: the tables and RLS
 * are role-agnostic (0071 widened the role each credit/batch can carry).
 */
export async function ReferralPanel({ userId }: { userId: string }) {
  const supabase = await createClient();

  const { data: user } = await supabase
    .from("users")
    .select("referral_code")
    .eq("id", userId)
    .maybeSingle();
  if (!user) return null;

  const [origin, { count: qualifyingCount }, { data: batches }] = await Promise.all([
    appUrl(),
    supabase
      .from("referral_credits")
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", userId),
    supabase.from("referral_payout_batches").select("amount_usd, status").eq("referrer_id", userId),
  ]);

  const link = buildReferralLink(origin, user.referral_code);
  const qrDataUrl = await QRCode.toDataURL(link, { margin: 1, width: 240 });
  const shareText = `Join ShipMova and I get $${REFERRAL_CREDIT_AMOUNT_USD} when you complete your first deal: ${link}`;

  const count = qualifyingCount ?? 0;
  const progress = count % REFERRAL_BATCH_SIZE;
  const paidBatches = (batches ?? []).filter((b) => b.status === "paid");
  const pendingBatches = (batches ?? []).filter((b) => b.status !== "paid");
  const paidUsd = paidBatches.reduce((sum, b) => sum + Number(b.amount_usd), 0);
  const pendingUsd = pendingBatches.reduce((sum, b) => sum + Number(b.amount_usd), 0);

  return (
    <section className="mt-10 rounded-lg border border-line bg-white p-6">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
        Referral program
      </h2>
      <p className="mt-2 text-sm text-muted">
        Refer {REFERRAL_BATCH_SIZE} people who complete a deal on ShipMova: buyers, sellers, shippers or
        inspectors. ${REFERRAL_CREDIT_AMOUNT_USD} each, paid out at ${REFERRAL_PAYOUT_AMOUNT_USD.toLocaleString()}.
      </p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, not an optimizable asset */}
        <img
          src={qrDataUrl}
          alt="QR code linking to your ShipMova referral signup page"
          className="h-32 w-32 rounded-lg border border-line"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            Your referral code
          </p>
          <p className="text-lg font-semibold text-ink">{user.referral_code}</p>
          <p className="mt-2 break-all text-sm text-muted">{link}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <CopyLinkButton link={link} />
            <WhatsAppShareButton text={shareText} />
            <a
              href={qrDataUrl}
              download="shipmova-referral-qr.png"
              className={buttonClasses({ size: "sm", variant: "secondary" })}
            >
              Download QR code
            </a>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-sm text-ink">
          {progress} of {REFERRAL_BATCH_SIZE} toward your ${REFERRAL_PAYOUT_AMOUNT_USD.toLocaleString()}
        </p>
        <div className="mt-1.5 h-2 w-full rounded-full bg-band">
          <div
            className="h-2 rounded-full bg-ink"
            style={{ width: `${(progress / REFERRAL_BATCH_SIZE) * 100}%` }}
          />
        </div>
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
          <div className="flex items-baseline gap-1.5">
            <dt>Pending:</dt>
            <dd className="font-semibold text-ink">{usd(pendingUsd)}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt>Paid:</dt>
            <dd className="font-semibold text-ink">{usd(paidUsd)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
