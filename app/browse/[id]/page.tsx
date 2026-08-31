import { type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/ui/verified-badge";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function BrowseHeader() {
  return (
    <header className="border-b border-paper-200 bg-paper-100">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-mono text-sm font-semibold uppercase tracking-widest text-ink-900">
          MOVA
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-slate-500 hover:text-ink-900">
            Sign in
          </Link>
          <Link href="/signup" className={buttonClasses({ size: "sm" })}>
            Create account
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Spec({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-xs uppercase tracking-wider text-ink-400">{label}</dt>
      <dd className="text-ink-900">{children}</dd>
    </div>
  );
}

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: v } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", id)
    .eq("status", "approved")
    .maybeSingle();

  if (!v) notFound();

  const { data: photos } = await supabase
    .from("vehicle_photos")
    .select("url, is_primary, sort_order")
    .eq("vehicle_id", id)
    .order("sort_order", { ascending: true });

  // Primary photo leads the gallery; the rest keep their sort order.
  const gallery = (photos ?? [])
    .slice()
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary));

  const title = `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`;

  return (
    <div className="min-h-screen bg-paper">
      <BrowseHeader />

      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link
          href="/browse"
          className="font-mono text-xs uppercase tracking-wider text-ink-400 hover:text-ink-900"
        >
          &larr; Back to browse
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold text-ink-900">{title}</h1>
          <VerifiedBadge />
        </div>
        <p className="mt-2 text-2xl font-semibold text-ink-900">
          {usd.format(Number(v.price_usd))}
        </p>
        <p className="mt-1 font-mono text-sm text-ink-400">
          {v.mileage.toLocaleString("en-US")} mi · {v.location_city}, {v.location_state}
        </p>

        {gallery.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {gallery.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={p.url}
                alt={`${title} photo ${i + 1}`}
                className={cn(
                  "w-full rounded-lg border border-paper-200 object-cover",
                  i === 0 ? "aspect-[16/10] sm:col-span-2" : "aspect-[4/3]"
                )}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-dashed border-paper-200 bg-paper-100 p-12 text-center font-mono text-xs uppercase tracking-wider text-ink-400">
            No photos provided
          </div>
        )}

        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Spec label="VIN">
            <span className="font-mono">{v.vin}</span>
          </Spec>
          <Spec label="Year">{v.year}</Spec>
          <Spec label="Mileage">{v.mileage.toLocaleString("en-US")} mi</Spec>
          {v.transmission ? <Spec label="Transmission">{v.transmission}</Spec> : null}
          {v.fuel_type ? <Spec label="Fuel">{v.fuel_type}</Spec> : null}
          {v.condition ? <Spec label="Condition">{v.condition}</Spec> : null}
          {v.exterior_color ? <Spec label="Exterior">{v.exterior_color}</Spec> : null}
          {v.interior_color ? <Spec label="Interior">{v.interior_color}</Spec> : null}
          {v.title_status ? <Spec label="Title">{v.title_status}</Spec> : null}
          {v.accident_history ? (
            <Spec label="Accident history">{v.accident_history}</Spec>
          ) : null}
          <Spec label="Location">
            {v.location_city}, {v.location_state}
          </Spec>
        </dl>

        {v.description ? (
          <section className="mt-8">
            <h2 className="font-mono text-xs uppercase tracking-wider text-ink-400">
              Description
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-500">
              {v.description}
            </p>
          </section>
        ) : null}

        <div className="mt-10 rounded-lg border border-paper-200 bg-paper-100 p-6">
          <p className="text-ink-900">Interested in this vehicle?</p>
          <p className="mt-1 text-sm text-slate-500">
            Create a buyer account to save it and start a purchase request.
          </p>
          <Link
            href="/signup"
            className={cn(buttonClasses({ size: "md" }), "mt-4")}
          >
            Create an account
          </Link>
        </div>
      </main>
    </div>
  );
}

export const dynamic = "force-dynamic";
