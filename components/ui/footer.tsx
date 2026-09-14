import Link from "next/link";
import { BUYER_PROTECTION_POLICY_PATH } from "@/lib/policy";

export function Footer() {
  return (
    <footer className="border-t border-paper-200 bg-paper-100">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-slate-500">
        <span className="font-mono text-xs uppercase tracking-widest text-ink-400">
          MOVA
        </span>
        <nav className="flex flex-wrap items-center gap-4">
          <Link href={BUYER_PROTECTION_POLICY_PATH} className="hover:text-ink-900">
            Buyer Protection &amp; Refund Policy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
