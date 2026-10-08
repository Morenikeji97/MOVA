import type { Metadata } from "next";
import { PolicyPage } from "@/components/ui/policy-page";
import { CURRENT_TERMS_VERSION, TERMS_EFFECTIVE_DATE } from "@/lib/terms";
import { TERMS_AND_CONDITIONS_MARKDOWN } from "@/lib/terms-content";

export const metadata: Metadata = {
  title: "Terms & Conditions — ShipMova",
  description: "The terms for using ShipMova as a buyer, seller or shipper.",
};

/**
 * Read-only copy of the Terms everyone accepts at /terms/accept (same
 * source), so they can be read before signing up. Under /policies, which
 * the buyer ID gate already exempts (lib/id-gate-paths.ts).
 */
export default function TermsPage() {
  return (
    <PolicyPage
      source={TERMS_AND_CONDITIONS_MARKDOWN}
      note={`Effective ${TERMS_EFFECTIVE_DATE} · Version ${CURRENT_TERMS_VERSION}`}
    />
  );
}
