import type { Metadata } from "next";
import { WaitlistForm } from "@/components/ui/waitlist-form";

export const metadata: Metadata = {
  title: "Join the waitlist — ShipMova",
  description: "Leave an email or WhatsApp number and we'll tell you the moment ShipMova launches.",
};

/**
 * The header's "Get Started" before launch, and the "opens at launch" hint on
 * /buyer/verify-id (exempt from the ID gate in lib/id-gate-paths.ts, so a
 * buyer who hasn't verified can still reach it).
 */
export default function WaitlistPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Launching soon</p>
      <h1 className="mt-2 text-3xl font-extrabold text-ink sm:text-4xl">Be first to know</h1>
      <p className="mt-3 text-muted">
        ShipMova isn&rsquo;t taking reservations or payments yet. Join the waitlist and we&rsquo;ll
        message you when buyers in West Africa can reserve U.S. cars.
      </p>
      <WaitlistForm source="site" heading="Join the waitlist" className="mt-8" />
    </main>
  );
}
