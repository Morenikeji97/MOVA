import type { Metadata } from "next";
import { PolicyPage } from "@/components/ui/policy-page";
import { SELLER_TERMS_MARKDOWN } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "Seller Terms — ShipMova",
  description: "What a Seller agrees to when listing a vehicle on ShipMova.",
};

/** Draft, pending attorney review — see the page's own text. */
export default function SellerTermsPage() {
  return <PolicyPage source={SELLER_TERMS_MARKDOWN} note="Draft v0.1 · pending attorney review" />;
}
