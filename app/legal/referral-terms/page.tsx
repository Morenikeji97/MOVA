import type { Metadata } from "next";
import { PolicyPage } from "@/components/ui/policy-page";
import { REFERRAL_TERMS_MARKDOWN } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "Referral Program Terms — ShipMova",
  description: "The exact rules for ShipMova's referral program: who can refer, what qualifies, and how payouts work.",
};

/** Draft, pending attorney review — see the page's own text. */
export default function ReferralTermsPage() {
  return <PolicyPage source={REFERRAL_TERMS_MARKDOWN} note="Draft v0.1 · pending attorney review" />;
}
