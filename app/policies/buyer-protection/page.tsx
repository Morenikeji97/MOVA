import type { Metadata } from "next";
import { PolicyPage } from "@/components/ui/policy-page";
import { BUYER_PROTECTION_POLICY_MARKDOWN } from "@/lib/policy-content";

export const metadata: Metadata = {
  title: "Buyer Protection & Refund Policy — ShipMova",
  description:
    "ShipMova's Buyer Protection & Refund Policy — when the service fee is refundable, and how disputes are handled.",
};

export default function BuyerProtectionPolicyPage() {
  return <PolicyPage source={BUYER_PROTECTION_POLICY_MARKDOWN} />;
}
