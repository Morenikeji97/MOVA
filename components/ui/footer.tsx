import Link from "next/link";
import { BUYER_PROTECTION_POLICY_PATH } from "@/lib/policy";
import { whatsappLink } from "@/lib/whatsapp";
import { SERVICE_COUNTRIES } from "@/lib/shipping";
import { Logo } from "@/components/ui/logo";

const PLATFORM_LINKS = [
  { label: "Browse Vehicles", href: "/browse" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Sell Your Car", href: "/sell" },
  { label: "Referrals", href: "/referrals" },
];

const PARTNER_LINKS = [
  { label: "Ship with us", href: "/shipper" },
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
      <p className="font-mono text-xs uppercase tracking-widest text-gray-400">
        {title}
      </p>
      <ul className="mt-4 flex flex-col gap-2 text-sm">{children}</ul>
    </div>
  );
}

export function Footer() {
  const wa = whatsappLink();

  return (
    <footer className="bg-black text-white print:hidden">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Logo height={48} />
            <p className="mt-4 max-w-xs text-sm text-gray-400">
              American cars. Global buyers.
            </p>
          </div>

          <FooterColumn title="Platform">
            {PLATFORM_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-gray-300 hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title="Partners">
            {PARTNER_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-gray-300 hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title="Legal">
            <li>
              <Link
                href={BUYER_PROTECTION_POLICY_PATH}
                className="text-gray-300 hover:text-white"
              >
                Buyer Protection &amp; Refund Policy
              </Link>
            </li>
          </FooterColumn>

          <FooterColumn title="Contact">
            {wa ? (
              <li>
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-white"
                >
                  WhatsApp
                </a>
              </li>
            ) : null}
          </FooterColumn>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-gray-800 pt-6 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} ShipMova. All rights reserved.</p>
          <p>
            Serving {SERVICE_COUNTRIES.map((c) => c.name).join(", ")}
          </p>
        </div>
      </div>
    </footer>
  );
}
