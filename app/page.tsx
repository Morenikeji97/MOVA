import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonClasses } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { VinData } from "@/components/ui/vin-data";
import type { UserRole } from "@/types/database";

// Same role → home mapping middleware.ts uses to gate these prefixes.
const DASHBOARD_BY_ROLE: Record<UserRole, string> = {
  seller: "/seller/dashboard",
  buyer: "/buyer/dashboard",
  admin: "/admin/dashboard",
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Determine role the same way middleware.ts does: users.role by auth id.
  let role: UserRole | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    role = profile?.role ?? null;
  }

  const dashboardHref = role ? DASHBOARD_BY_ROLE[role] : "/browse";

  return (
    <main className="min-h-screen bg-paper">
      <header className="bg-ink text-white">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="font-mono text-sm font-semibold uppercase tracking-widest">
            MOVA
          </span>
          <div className="flex items-center gap-4 text-sm">
            {user ? (
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
      </section>
    </main>
  );
}

export const dynamic = "force-dynamic";
