import type { Metadata } from "next";
import { Banknote, CalendarClock, ClipboardList, HeartHandshake } from "lucide-react";
import { BenefitsSection, type Benefit } from "@/components/ui/benefits-section";
import { PartnerWaitlistForm } from "@/components/ui/partner-waitlist-form";

export const metadata: Metadata = {
  title: "Become a ShipMova inspector",
  description: "Earn on your schedule checking cars near you before they ship overseas.",
};

const INSPECTOR_BENEFITS: Benefit[] = [
  {
    icon: Banknote,
    title: "Paid for every inspection",
    body: "2% of the car's price per completed inspection (for example, $300 on a $15,000 car).",
  },
  {
    icon: CalendarClock,
    title: "Local, flexible jobs",
    body: "Take inspections near you, when it suits you.",
  },
  {
    icon: ClipboardList,
    title: "Clear, simple checklist",
    body: "Confirm the VIN, mileage, title and condition, and take photos through ShipMova.",
  },
  {
    icon: HeartHandshake,
    title: "Your work builds trust",
    body: "Buyers across West Africa rely on your report to buy with confidence.",
  },
];

/** Public page for would-be inspectors; signups go to the waitlist (audience "inspector"). */
export default function InspectorsPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="bg-black text-white">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
            Become a ShipMova inspector
          </h1>
          <p className="mt-4 max-w-xl text-gray-300">
            Earn on your schedule checking cars near you before they ship overseas.
          </p>
          <a
            href="#register"
            className="mt-8 inline-flex h-13 items-center justify-center rounded bg-white px-7 text-lg font-medium text-black hover:bg-gray-200"
          >
            Register your interest &rarr;
          </a>
        </div>
      </section>

      <BenefitsSection
        benefits={INSPECTOR_BENEFITS}
      >
        <div className="mt-10 max-w-2xl rounded-lg border border-gray-200 bg-gray-100 p-5">
          <h3 className="font-semibold text-black">Who we&rsquo;re looking for</h3>
          <p className="mt-1 text-sm text-gray-500">
            People who know cars (mechanics, detailers, car enthusiasts) and can pass our short
            knowledge check. ASE certification is a plus, not required.
          </p>
        </div>
      </BenefitsSection>

      <section id="register" className="scroll-mt-4 border-t border-gray-200 bg-gray-100">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <PartnerWaitlistForm audience="inspector" />
        </div>
      </section>
    </main>
  );
}
