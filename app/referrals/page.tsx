import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, SectionHeading, heroButtonClasses } from "@/components/ui/page-hero";
import { REFERRAL_BATCH_SIZE, REFERRAL_PAYOUT_AMOUNT_USD } from "@/lib/referrals";

export const metadata: Metadata = {
  title: "Referral Program — ShipMova",
  description: `Earn $${REFERRAL_PAYOUT_AMOUNT_USD} for every ${REFERRAL_BATCH_SIZE} people you refer to ShipMova who complete a transaction.`,
};

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink font-display text-sm font-bold text-white">
        {n}
      </div>
      <div>
        <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
        <p className="mt-1 text-sm text-muted">{children}</p>
      </div>
    </div>
  );
}

export default function ReferralsPage() {
  return (
    <main className="min-h-screen bg-white">
      <PageHero
        narrow
        eyebrow="ShipMova Referral Program"
        title={
          <>
            Earn ${REFERRAL_PAYOUT_AMOUNT_USD.toLocaleString()} for every {REFERRAL_BATCH_SIZE} people you bring
            to ShipMova.
          </>
        }
        intro={
          <>
            Every Buyer and every Seller account gets its own referral link. Once {REFERRAL_BATCH_SIZE} people
            you referred complete a transaction on ShipMova, you get paid $
            {REFERRAL_PAYOUT_AMOUNT_USD.toLocaleString()}. No cap — refer {REFERRAL_BATCH_SIZE * 2}, get paid
            twice; refer {REFERRAL_BATCH_SIZE * 10}, get paid ten times.
          </>
        }
      >
        <Link href="/signup" className={heroButtonClasses("solid")}>
          Create your account
        </Link>
        <Link href="/login" className={heroButtonClasses("outline")}>
          I already have an account
        </Link>
      </PageHero>

      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
        <SectionHeading title="How it works" />
        <div className="mt-8 flex flex-col gap-8">
          <Step n={1} title="Get your link">
            Sign in to your Buyer or Seller dashboard for your unique referral
            code, a shareable link, and a QR code you can post, text, or
            print.
          </Step>
          <Step n={2} title="Share it">
            A Buyer&rsquo;s link only credits when the person they refer also
            signs up as a Buyer; a Seller&rsquo;s link only credits for
            another Seller. Referring across roles doesn&rsquo;t count.
          </Step>
          <Step n={3} title="They complete a transaction">
            A referral qualifies once the person you referred pays
            ShipMova&rsquo;s service fee on their first transaction and passes
            their own identity verification.
          </Step>
          <Step n={4} title={`Get paid every ${REFERRAL_BATCH_SIZE}`}>
            Once you hit {REFERRAL_BATCH_SIZE} qualifying referrals, ShipMova
            pays out ${REFERRAL_PAYOUT_AMOUNT_USD.toLocaleString()} — and the
            count keeps going toward your next payout.
          </Step>
        </div>

        <p className="mt-10 text-sm text-muted">
          Track your progress, referral code, and lifetime earnings any time
          from your{" "}
          <Link href="/buyer/dashboard" className="text-ink underline underline-offset-2">
            Buyer
          </Link>{" "}
          or{" "}
          <Link href="/seller/dashboard" className="text-ink underline underline-offset-2">
            Seller
          </Link>{" "}
          dashboard.
        </p>
      </section>
    </main>
  );
}
