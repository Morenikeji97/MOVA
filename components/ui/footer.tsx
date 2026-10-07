import Link from "next/link";
import { BUYER_PROTECTION_POLICY_PATH } from "@/lib/policy";
import { whatsappLink } from "@/lib/whatsapp";
import { SERVICE_COUNTRIES } from "@/lib/shipping";
import { Logo } from "@/components/ui/logo";

const PLATFORM_LINKS = [
  { label: "Buy a vehicle", href: "/browse" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Sell your vehicle", href: "/sell" },
  { label: "Referrals", href: "/referrals" },
];

const PARTNER_LINKS = [
  { label: "Become a shipper", href: "/shipper" },
  { label: "Become an inspector", href: "/inspectors" },
  { label: "Clearing agents (Nigeria)", href: "/clearing-agents" },
];

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">{title}</p>
      <ul className="mt-3 flex flex-col text-sm">{children}</ul>
    </div>
  );
}

// Each link is a full 44px row on phones (tap target), tighter on desktop.
const LINK = "flex h-11 items-center text-white/80 hover:text-white sm:h-9";

/** The one shared site footer (design system, redesign PR A). */
export function Footer() {
  const wa = whatsappLink();

  return (
    <footer className="bg-ink text-white print:hidden">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Logo height={40} />
            <p className="mt-4 max-w-xs text-sm text-white/60">
              Quality vehicles from the U.S. to West Africa.
            </p>
          </div>

          <FooterColumn title="Platform">
            {PLATFORM_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={LINK}>
                  {link.label}
                </Link>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title="Partners">
            {PARTNER_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={LINK}>
                  {link.label}
                </Link>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title="Legal">
            <li>
              <Link href={BUYER_PROTECTION_POLICY_PATH} className={LINK}>
                Buyer Protection &amp; Refund Policy
              </Link>
            </li>
            <li>
              <Link href="/policies/terms" className={LINK}>
                Terms &amp; Conditions
              </Link>
            </li>
            <li>
              <Link href="/policies/privacy" className={LINK}>
                Privacy Policy
              </Link>
            </li>
          </FooterColumn>

          <FooterColumn title="Contact">
            {wa ? (
              <li>
                <a href={wa} target="_blank" rel="noopener noreferrer" className={LINK}>
                  WhatsApp
                </a>
              </li>
            ) : null}
          </FooterColumn>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} ShipMova. All rights reserved.</p>
          <p>Serving {SERVICE_COUNTRIES.map((c) => c.name).join(", ")}</p>
        </div>
      </div>
    </footer>
  );
}
