import { type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { ReviewActions } from "./review-actions";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const submitted = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-xs uppercase tracking-wider text-ink-400">{label}</dt>
      <dd className="text-ink-900">{children}</dd>
    </div>
  );
}

export default async function AdminListingReviewPage() {
  const supabase = await createClient();

  // Oldest first — the seller who has waited longest is at the top.
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .eq("status", "pending_review")
    .order("updated_at", { ascending: true });

  const rows = vehicles ?? [];
  const sellerIds = [...new Set(rows.map((v) => v.seller_id))];
  const vehicleIds = rows.map((v) => v.id);

  const [sellersRes, photosRes] = await Promise.all([
    sellerIds.length
      ? supabase.from("users").select("id, email, phone").in("id", sellerIds)
      : null,
    vehicleIds.length
      ? supabase
          .from("vehicle_photos")
          .select("vehicle_id, url, is_primary, sort_order")
          .in("vehicle_id", vehicleIds)
          .order("sort_order", { ascending: true })
      : null,
  ]);

  const sellerById = new Map((sellersRes?.data ?? []).map((s) => [s.id, s]));
  const photosByVehicle = new Map<string, { url: string; is_primary: boolean }[]>();
  for (const p of photosRes?.data ?? []) {
    const list = photosByVehicle.get(p.vehicle_id) ?? [];
    list.push({ url: p.url, is_primary: p.is_primary });
    photosByVehicle.set(p.vehicle_id, list);
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link
        href="/admin/dashboard"
        className="font-mono text-xs uppercase tracking-wider text-ink-400 hover:text-ink-900"
      >
        &larr; Admin dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-ink-900">Listing review queue</h1>
      <p className="mt-2 text-sm text-slate-500">
        {rows.length === 0
          ? "Nothing waiting for review right now."
          : `${rows.length} listing${rows.length === 1 ? "" : "s"} awaiting review.`}
      </p>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-paper-200 bg-paper-100 p-10 text-center">
          <p className="text-ink-900">The queue is clear.</p>
          <p className="mt-1 text-sm text-slate-500">
            New submissions from sellers will show up here.
          </p>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {rows.map((v) => {
            const seller = sellerById.get(v.seller_id);
            const photos = (photosByVehicle.get(v.id) ?? [])
              .slice()
              .sort((a, b) => Number(b.is_primary) - Number(a.is_primary));

            return (
              <li
                key={v.id}
                className="rounded-lg border border-paper-200 bg-paper-100 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-ink-900">
                      {v.year} {v.make} {v.model}
                      {v.trim ? ` ${v.trim}` : ""}
                    </h2>
                    <p className="mt-1 font-mono text-sm text-ink-400">
                      {usd.format(Number(v.price_usd))} ·{" "}
                      {v.mileage.toLocaleString("en-US")} mi · {v.location_city},{" "}
                      {v.location_state}
                    </p>
                    <p className="mt-1 font-mono text-xs uppercase tracking-wider text-ink-400">
                      VIN {v.vin}
                      {v.vin_decode_status === "mismatch"
                        ? " · VIN mismatch flagged"
                        : ""}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-marine-50 px-2.5 py-1 text-sm font-medium text-marine-700">
                    Pending review
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                  <Detail label="Seller">{seller?.email ?? "—"}</Detail>
                  {seller?.phone ? (
                    <Detail label="Phone">{seller.phone}</Detail>
                  ) : null}
                  <Detail label="Submitted">
                    {submitted.format(new Date(v.updated_at))}
                  </Detail>
                  {v.transmission ? (
                    <Detail label="Transmission">{v.transmission}</Detail>
                  ) : null}
                  {v.fuel_type ? <Detail label="Fuel">{v.fuel_type}</Detail> : null}
                  {v.condition ? (
                    <Detail label="Condition">{v.condition}</Detail>
                  ) : null}
                  {v.exterior_color ? (
                    <Detail label="Exterior">{v.exterior_color}</Detail>
                  ) : null}
                  {v.title_status ? (
                    <Detail label="Title">{v.title_status}</Detail>
                  ) : null}
                  {v.accident_history ? (
                    <Detail label="Accidents">{v.accident_history}</Detail>
                  ) : null}
                </dl>

                {v.description ? (
                  <p className="mt-3 whitespace-pre-line text-sm text-slate-500">
                    {v.description}
                  </p>
                ) : null}

                {photos.length > 0 ? (
                  <div className="mt-4 flex gap-2 overflow-x-auto">
                    {photos.map((p, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={p.url}
                        alt={`${v.year} ${v.make} ${v.model} photo ${i + 1}`}
                        className={cn(
                          "h-28 w-40 shrink-0 rounded border object-cover",
                          p.is_primary ? "border-marine" : "border-paper-200"
                        )}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-copper-700">No photos uploaded.</p>
                )}

                <ReviewActions vehicleId={v.id} />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
