import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonClasses } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { VinData } from "@/components/ui/vin-data";
import { VehicleCard } from "@/components/ui/vehicle-card";
import { loadRecentApprovedListings } from "@/lib/listings";
import type { UserRole } from "@/types/database";

// Same role → home mapping middleware.ts uses to gate these prefixes.
const DASHBOARD_BY_ROLE: Record<UserRole, string> = {
  seller: "/seller/dashboard",
  buyer: "/buyer/dashboard",
  admin: "/admin/dashboard",
};

/**
 * Resolve the current viewer for the header nav.
 *
 * "Signed in" means Supabase positively confirmed a user — a concrete
 * `data.user.id` and no error. Everything else (no session cookie, an expired
 * or malformed token, the auth endpoint erroring, an exception) resolves to
 * `null`, i.e. signed out. We never infer "signed in" from the absence of an
 * error, so a failed/empty session check can't fall through to the Dashboard
 * branch.
 */
async function resolveViewer(): Promise<{
  signedIn: boolean;
  role: UserRole | null;
}> {
  const supabase = await createClient();

  let userId: string | null = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user?.id) {
      userId = data.user.id;
    }
  } catch {
    userId = null;
  }

  if (!userId) return { signedIn: false, role: null };

  // Determine role the same way middleware.ts does: users.role by auth id.
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .single();

  return { signedIn: true, role: profile?.role ?? null };
}

export default async function Home() {
  const { signedIn, role } = await resolveViewer();
  const dashboardHref = role ? DASHBOARD_BY_ROLE[role] : "/browse";

  // Live inventory for the listings grid — most recent approved listings,
  // newest first, same source as /browse.
  const supabase = await createClient();
  const { rows: listings, thumbByVehicle } = await loadRecentApprovedListings(
    supabase,
    8,
  );

  return (
    <main className="min-h-screen bg-paper">
      <header className="bg-ink text-white">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="font-mono text-sm font-semibold uppercase tracking-widest">
            MOVA
          </span>
          <div className="flex items-center gap-4 text-sm">
            {signedIn ? (
              <Link
                href={dashboardHref}
                className={buttonClasses({
                  variant: "secondary",
                  size: "sm",
                  className: "border-white text-white hover:bg-white/10",
                })}
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-ink-100 hover:text-white">
                  Sign in
                </Link>
                <Link href="/signup" className={buttonClasses({ size: "sm" })}>
                  Create account
                </Link>
              </>
            )}
          </div>
        </nav>

        <div className="mx-auto max-w-6xl px-6 pb-24 pt-12">
          <p className="font-mono text-sm uppercase tracking-widest text-marine-400">
            Houston, TX → Lagos, NG
          </p>
          <h1 className="mt-4 max-w-2xl text-5xl font-semibold leading-tight">
            American cars. Global buyers.
          </h1>
          <p className="mt-4 max-w-xl text-ink-100">
            MOVA connects verified U.S. sellers with international buyers —
            starting in Nigeria.
          </p>
          <div className="mt-8 flex gap-3">
            <Link
              href="/browse"
              className={buttonClasses({ variant: "primary", size: "lg" })}
            >
              Browse Vehicles
            </Link>
            <Link
              href="/seller/listings/new"
              className={buttonClasses({
                variant: "secondary",
                size: "lg",
                className: "border-white text-white hover:bg-white/10",
              })}
            >
              List Your Vehicle
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-16">
        {listings.length > 0 ? (
          <>
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <h2 className="font-mono text-xs uppercase tracking-wider text-ink-400">
                Latest verified listings
              </h2>
              <Link
                href="/browse"
                className="text-sm text-marine-700 hover:underline"
              >
                Browse all &rarr;
              </Link>
            </div>
            <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((v) => (
                <li key={v.id}>
                  <VehicleCard
                    vehicle={v}
                    thumbnailUrl={thumbByVehicle.get(v.id) ?? null}
                  />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <h2 className="mb-6 font-mono text-xs uppercase tracking-wider text-ink-400">
              Sample vehicle card — design system preview
            </h2>
            <div className="max-w-sm rounded-lg border border-paper-200 bg-paper-100 p-5 shadow-sm">
              <div className="mb-4 flex items-start justify-between">
                <h3 className="text-lg font-semibold text-ink-900">
                  2019 Toyota Camry SE
                </h3>
                <VerifiedBadge />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <VinData label="Mileage" value="62,000 mi" />
                <VinData label="Location" value="Houston, TX" />
                <VinData label="Price" value="$14,500" />
                <VinData label="VIN" value="4T1B11HK..." />
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

// The nav differs per viewer (signed-in vs not), so this page must be rendered
// per request and never served from a shared cache. `force-dynamic` renders on
// every request; `revalidate = 0` and the `Cache-Control` header for `/` in
// next.config.ts keep any CDN/proxy in front of it from handing one visitor's
// (e.g. a signed-in) HTML to the next (e.g. an anonymous incognito visitor).
export const dynamic = "force-dynamic";
export const revalidate = 0;
