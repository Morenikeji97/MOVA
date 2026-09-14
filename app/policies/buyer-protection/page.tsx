import type { Metadata } from "next";
import Link from "next/link";
import { MarkdownLite } from "@/components/ui/markdown-lite";
import { BUYER_PROTECTION_POLICY_MARKDOWN } from "@/lib/policy-content";

export const metadata: Metadata = {
  title: "Buyer Protection & Refund Policy — MOVA",
  description:
    "MOVA's Buyer Protection & Refund Policy — when the service fee is refundable, and how disputes are handled.",
};

export default function BuyerProtectionPolicyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/"
        className="font-mono text-xs uppercase tracking-wider text-ink-400 hover:text-ink-900"
      >
        &larr; MOVA
      </Link>
      <article className="mt-6">
        <MarkdownLite source={BUYER_PROTECTION_POLICY_MARKDOWN} />
      </article>
    </main>
  );
}
