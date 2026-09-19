import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { REFERRAL_BATCH_SIZE, REFERRAL_PAYOUT_AMOUNT_USD } from "@/lib/referrals";

export const metadata: Metadata = {
  title: "Referral Program — MOVA",
  description: `Earn $${REFERRAL_PAYOUT_AMOUNT_USD} for every ${REFERRAL_BATCH_SIZE} people you refer to MOVA who complete a transaction.`,
};

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-sm font-semibold text-white">
        {n}
      </div>
      <div>
        <h3 className="font-semibold text-black">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">{children}</p>
      </div>
    </div>
  );
}

export default function ReferralsPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="bg-black text-white">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <p className="font-mono text-sm uppercase tracking-widest text-gray-400">
            MOVA Referral Program
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
            Earn ${REFERRAL_PAYOUT_AMOUNT_USD.toLocaleString()} for every {REFERRAL_BATCH_SIZE}{" "}
            people you bring to MOVA.
          </h1>
          <p className="mt-4 max-w-xl text-gray-300">
            Every Buyer and every Seller account gets its own referral link.
            Once {REFERRAL_BATCH_SIZE} people you referred complete a
            transaction on MOVA, you get paid ${REFERRAL_PAYOUT_AMOUNT_USD.toLocaleString()}
            . No cap — refer {REFERRAL_BATCH_SIZE * 2}, get paid twice; refer{" "}
            {REFERRAL_BATCH_SIZE * 10}, get paid ten times.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className={buttonClasses({ size: "lg" })}>
              Create your account
            </Link>
            <Link
              href="/login"
              className="inline-flex h-13 items-center justify-center rounded border border-white px-7 text-lg font-medium text-white hover:bg-white/10"
            >
              I already have an account
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="font-mono text-xs uppercase tracking-wider text-gray-500">
          How it works
        </h2>
        <div className="mt-6 flex flex-col gap-8">
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
            MOVA&rsquo;s service fee on their first transaction and passes
            their own identity verification.
          </Step>
          <Step n={4} title={`Get paid every ${REFERRAL_BATCH_SIZE}`}>
            Once you hit {REFERRAL_BATCH_SIZE} qualifying referrals, MOVA
            pays out ${REFERRAL_PAYOUT_AMOUNT_USD.toLocaleString()} — and the
            count keeps going toward your next payout.
          </Step>
        </div>

        <p className="mt-10 text-sm text-gray-500">
          Track your progress, referral code, and lifetime earnings any time
          from your{" "}
          <Link href="/buyer/dashboard" className="text-black underline underline-offset-2">
            Buyer
          </Link>{" "}
          or{" "}
          <Link href="/seller/dashboard" className="text-black underline underline-offset-2">
            Seller
          </Link>{" "}
          dashboard.
        </p>
      </section>
    </main>
  );
}
