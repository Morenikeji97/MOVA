import type { Metadata } from "next";
import { Banknote, CalendarClock, ClipboardList, HeartHandshake } from "lucide-react";
import { BenefitsSection, type Benefit } from "@/components/ui/benefits-section";
import { PartnerWaitlistForm } from "@/components/ui/partner-waitlist-form";
import { ArrowRightIcon } from "@/components/ui/icons";
import { PageHero, heroButtonClasses } from "@/components/ui/page-hero";

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
      <PageHero
        eyebrow="For inspectors"
        title="Become a ShipMova inspector"
        intro="Earn on your schedule checking cars near you before they ship overseas."
      >
        <a href="#register" className={heroButtonClasses("solid")}>
          Register your interest <ArrowRightIcon size={18} />
        </a>
      </PageHero>

      <BenefitsSection
        benefits={INSPECTOR_BENEFITS}
      >
        <div className="mt-10 max-w-2xl rounded-card border border-line bg-band p-5">
          <h3 className="font-display text-lg font-bold text-ink">Who we&rsquo;re looking for</h3>
          <p className="mt-1 text-sm text-muted">
            People who know cars (mechanics, detailers, car enthusiasts) and can pass our short
            knowledge check. ASE certification is a plus, not required.
          </p>
        </div>
      </BenefitsSection>

      <section id="register" className="scroll-mt-4 border-t border-line bg-band">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
          <PartnerWaitlistForm audience="inspector" />
        </div>
      </section>
    </main>
  );
}
