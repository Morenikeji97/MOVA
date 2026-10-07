import type { Metadata } from "next";
import { Anchor, FileCheck, Gift, Users } from "lucide-react";
import { BenefitsSection, type Benefit } from "@/components/ui/benefits-section";
import { PartnerWaitlistForm } from "@/components/ui/partner-waitlist-form";
import { ArrowRightIcon } from "@/components/ui/icons";
import { PageHero, heroButtonClasses } from "@/components/ui/page-hero";
import { NIGERIA_PORTS } from "@/lib/prelaunch";

export const metadata: Metadata = {
  title: "Partner with ShipMova in Nigeria — clearing agents",
  description: "Pre-verified U.S. cars and buyers who need a trusted clearing agent.",
};

const AGENT_BENEFITS: Benefit[] = [
  {
    icon: Anchor,
    title: "Cars that clear cleanly",
    body: "Import age, VIN and title are checked before the car ever ships, so fewer problems at the port.",
  },
  {
    icon: Users,
    title: "Buyers sent your way",
    body: "We recommend partner agents to buyers whose shipment doesn't include clearing.",
  },
  {
    icon: FileCheck,
    title: "Documents in order",
    body: "Original title and verified vehicle details travel with every car.",
  },
  {
    icon: Gift,
    title: "Rewards for partners",
    body: "Referral rewards for partner agents (details when you join).",
  },
];

/** Public page for Nigerian clearing agents; signups go to the waitlist (audience "clearing_agent"). */
export default function ClearingAgentsPage() {
  return (
    <main className="min-h-screen bg-white">
      <PageHero
        eyebrow="For clearing agents"
        title="Partner with ShipMova in Nigeria"
        intro="Pre-verified U.S. cars and buyers who need a trusted clearing agent."
      >
        <a href="#register" className={heroButtonClasses("solid")}>
          Become a partner agent <ArrowRightIcon size={18} />
        </a>
      </PageHero>

      <BenefitsSection
        benefits={AGENT_BENEFITS}
      >
        <p className="mt-8 text-sm text-muted">
          <span className="font-semibold text-ink">Ports:</span> {NIGERIA_PORTS.join(", ")}.
        </p>
      </BenefitsSection>

      <section id="register" className="scroll-mt-4 border-t border-line bg-band">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
          <PartnerWaitlistForm audience="clearing_agent" />
        </div>
      </section>
    </main>
  );
}
