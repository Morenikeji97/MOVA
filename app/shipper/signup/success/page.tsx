import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export default function ShipperSignupSuccessPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold text-ink-900">Application received</h1>
      <p className="mt-3 text-slate-500">
        Thanks — your card is on file and your shipper application is with the
        MOVA team for review. We&rsquo;ll be in touch by email once it&rsquo;s
        approved, and your rates will then be visible to buyers.
      </p>
      <p className="mt-2 text-sm text-slate-500">
        Nothing has been charged. MOVA collects its 8% commission only after a
        shipment you arrange is marked completed.
      </p>
      <Link href="/" className={buttonClasses({ className: "mt-6 self-center" })}>
        Back to MOVA
      </Link>
    </main>
  );
}
