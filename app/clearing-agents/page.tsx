import type { Metadata } from "next";
import { Anchor, FileCheck, Gift, Users } from "lucide-react";
import { BenefitsSection, type Benefit } from "@/components/ui/benefits-section";
import { PartnerWaitlistForm } from "@/components/ui/partner-waitlist-form";
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
      <section className="bg-black text-white">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
            Partner with ShipMova in Nigeria
          </h1>
          <p className="mt-4 max-w-xl text-gray-300">
            Pre-verified U.S. cars and buyers who need a trusted clearing agent.
          </p>
          <a
            href="#register"
            className="mt-8 inline-flex h-13 items-center justify-center rounded bg-white px-7 text-lg font-medium text-black hover:bg-gray-200"
          >
            Become a partner agent &rarr;
          </a>
        </div>
      </section>

      <BenefitsSection
        benefits={AGENT_BENEFITS}
      >
        <p className="mt-8 text-sm text-gray-500">
          <span className="font-semibold text-black">Ports:</span> {NIGERIA_PORTS.join(", ")}.
        </p>
      </BenefitsSection>

      <section id="register" className="scroll-mt-4 border-t border-gray-200 bg-gray-100">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <PartnerWaitlistForm audience="clearing_agent" />
        </div>
      </section>
    </main>
  );
}
