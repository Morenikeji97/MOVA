import type { Metadata } from "next";
import { PolicyPage } from "@/components/ui/policy-page";
import { CURRENT_PRIVACY_VERSION, PRIVACY_EFFECTIVE_DATE } from "@/lib/privacy";
import { PRIVACY_POLICY_MARKDOWN } from "@/lib/privacy-content";

export const metadata: Metadata = {
  title: "Privacy Policy — ShipMova",
  description: "What ShipMova collects, why, and how it's protected.",
};

/** Read-only copy of the Privacy Policy accepted at /terms/accept (same source). */
export default function PrivacyPage() {
  return (
    <PolicyPage
      source={PRIVACY_POLICY_MARKDOWN}
      note={`Effective ${PRIVACY_EFFECTIVE_DATE} · Version ${CURRENT_PRIVACY_VERSION}`}
    />
  );
}
