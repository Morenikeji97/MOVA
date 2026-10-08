import Link from "next/link";
import { HeaderControls, type NavLink } from "@/components/ui/header-controls";
import { Logo } from "@/components/ui/logo";
import { createClient } from "@/lib/supabase/server";
import { isPrelaunch } from "@/lib/prelaunch";
import { selectedDisplayCurrency } from "@/lib/display-currency";
import { getDisplayCurrency } from "@/lib/display-currency-server";

const BASE_NAV_LINKS: NavLink[] = [
  { label: "Buy", href: "/browse" },
  { label: "Sell", href: "/sell" },
  { label: "Shipping", href: "/how-it-works#shipping" },
  { label: "Inspections", href: "/inspectors" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Referrals", href: "/referrals" },
];

/**
 * The one shared site header, mounted once in the root layout so it appears
 * on every page, dashboards included (design system, redesign PR A).
 *
 * Always a single row, never wrapping: logo left; on desktop (lg+) the nav
 * links, then the currency switcher and account controls; on phones and
 * tablets a ≥44px menu button that opens a full-screen menu holding all of
 * those (components/ui/header-controls.tsx).
 *
 * "Sell" is hidden for signed-in buyers — a buyer browsing/reserving has no
 * reason to be pointed at seller onboarding. Everyone else sees every link.
 * "Shipping" is the How It Works shipping section (shippers have their own
 * footer link, /shipper). Sign In / Create account / My dashboard / Sign
 * out: components/ui/header-controls.tsx.
 */
export async function Header() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    currency,
  ] = await Promise.all([supabase.auth.getUser(), getDisplayCurrency()]);

  let isBuyer = false;
  if (user) {
    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
    isBuyer = profile?.role === "buyer";
  }

  const navLinks = isBuyer ? BASE_NAV_LINKS.filter((link) => link.href !== "/sell") : BASE_NAV_LINKS;

  return (
    <header className="bg-ink text-white print:hidden">
      <div className="mx-auto flex h-16 max-w-6xl flex-nowrap items-center justify-between gap-4 px-4 sm:px-6 lg:h-[72px]">
        <Link href="/" className="flex shrink-0 items-center" aria-label="ShipMova home">
          <Logo height={32} className="lg:!h-9" />
        </Link>

        <nav aria-label="Main" className="hidden min-w-0 items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex h-11 items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium text-white/85 hover:bg-white/10 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <HeaderControls
          navLinks={navLinks}
          currency={selectedDisplayCurrency(currency)}
          waitlistHref={isPrelaunch() ? "/waitlist" : null}
        />
      </div>
    </header>
  );
}
