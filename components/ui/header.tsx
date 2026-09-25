import Link from "next/link";
import { AccountMenu } from "@/components/ui/account-menu";
import { createClient } from "@/lib/supabase/server";

const BASE_NAV_LINKS = [
  { label: "Browse Vehicles", href: "/browse" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Sell Your Car", href: "/seller/listings/new" },
  { label: "Ship With Us", href: "/shipper" },
  { label: "Referrals", href: "/referrals" },
];

/**
 * Persistent site header, mounted once in the root layout so it appears on
 * every page — buyer/seller/shipper/admin dashboards included, not just the
 * public marketing pages. Replaces the four hand-rolled per-page headers
 * that existed before (app/page.tsx, the duplicated BrowseHeader() in
 * app/browse/page.tsx and app/browse/[id]/page.tsx, and how-it-works'
 * back-link header).
 *
 * Logo is the real vector lockup (public/mova-logo-white-transparent.svg),
 * not a raster image, so it stays crisp at any size.
 *
 * "Sell Your Car" is hidden for signed-in buyers — a buyer browsing/reserving
 * vehicles has no reason to be pointed at seller onboarding, and showing it
 * only muddies what MOVA thinks this visitor is here to do. Logged-out
 * visitors and sellers/shippers/admins still see the full nav.
 */
export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isBuyer = false;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    isBuyer = profile?.role === "buyer";
  }

  const navLinks = isBuyer
    ? BASE_NAV_LINKS.filter((link) => link.label !== "Sell Your Car")
    : BASE_NAV_LINKS;

  return (
    <header className="bg-black text-white print:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="flex shrink-0 items-center" aria-label="MOVA home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mova-logo-white-transparent.svg"
            alt="MOVA"
            className="h-8 w-auto"
          />
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-gray-300">
              {link.label}
            </Link>
          ))}
        </nav>

        <AccountMenu />
      </div>

      {/* Mobile nav — same links, wraps below the logo/account row on small
          screens rather than hiding behind a menu button, since there are
          only four items. */}
      <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 px-6 pb-4 text-sm font-medium md:hidden">
        {navLinks.map((link) => (
          <Link key={link.href} href={link.href} className="hover:text-gray-300">
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
