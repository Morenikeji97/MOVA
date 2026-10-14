import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, SectionHeading, heroButtonClasses } from "@/components/ui/page-hero";
import {
  REFERRAL_BATCH_SIZE,
  REFERRAL_CREDIT_AMOUNT_USD,
  REFERRAL_PAYOUT_AMOUNT_USD,
} from "@/lib/referrals";

export const metadata: Metadata = {
  title: "Referral Program — ShipMova",
  description: `Earn $${REFERRAL_CREDIT_AMOUNT_USD} per referral, paid out at $${REFERRAL_PAYOUT_AMOUNT_USD} every ${REFERRAL_BATCH_SIZE} — buyers, sellers, shippers and inspectors.`,
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
        title={<>Earn ${REFERRAL_PAYOUT_AMOUNT_USD.toLocaleString()} with ShipMova.</>}
        intro={
          <>
            Refer {REFERRAL_BATCH_SIZE} people who complete a deal: buyers, sellers, shippers or inspectors.
            ${REFERRAL_CREDIT_AMOUNT_USD} each, paid out at ${REFERRAL_PAYOUT_AMOUNT_USD.toLocaleString()}. Anyone with
            a ShipMova account can refer anyone — a Buyer can refer a Shipper, a Seller can refer a Buyer, and so on.
            No cap: refer {REFERRAL_BATCH_SIZE * 2}, get paid twice; refer {REFERRAL_BATCH_SIZE * 10}, get paid ten
            times.
          </>
        }
      >
        <Link href="/signup" className={heroButtonClasses("solid")}>
          Get your referral link
        </Link>
        <Link href="/login" className={heroButtonClasses("outline")}>
          I already have an account
        </Link>
      </PageHero>

      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
        <SectionHeading title="How it works" />
        <div className="mt-8 flex flex-col gap-8">
          <Step n={1} title="Share your link">
            Sign in to your Buyer, Seller, Shipper or Inspector dashboard for your own referral code, link and QR
            code — copy it or share it straight to WhatsApp.
          </Step>
          <Step n={2} title="They complete a deal">
            A Buyer buys a car through a completed escrow deal; a Seller sells one; a Shipper completes their first
            shipment; an Inspector completes their first paid inspection.
          </Step>
          <Step n={3} title="You get paid at 10">
            Each qualifying referral is worth ${REFERRAL_CREDIT_AMOUNT_USD}. Once {REFERRAL_BATCH_SIZE} of them land,
            ShipMova pays out ${REFERRAL_PAYOUT_AMOUNT_USD.toLocaleString()} — and the count keeps going toward your
            next payout. Below {REFERRAL_BATCH_SIZE}, it shows as pending in your dashboard.
          </Step>
        </div>

        <p className="mt-10 text-sm text-muted">
          The full rules are in the{" "}
          <Link href="/legal/referral-terms" className="text-ink underline underline-offset-2">
            Referral Program Terms
          </Link>
          , including the anti-fraud checks ShipMova runs on every referral. Track your own progress, link and
          lifetime earnings any time from your{" "}
          <Link href="/buyer/dashboard" className="text-ink underline underline-offset-2">
            Buyer
          </Link>
          ,{" "}
          <Link href="/seller/dashboard" className="text-ink underline underline-offset-2">
            Seller
          </Link>
          ,{" "}
          <Link href="/shipper/dashboard" className="text-ink underline underline-offset-2">
            Shipper
          </Link>{" "}
          or{" "}
          <Link href="/inspector" className="text-ink underline underline-offset-2">
            Inspector
          </Link>{" "}
          dashboard.
        </p>
      </section>
    </main>
  );
}
