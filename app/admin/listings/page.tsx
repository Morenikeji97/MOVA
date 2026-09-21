import { type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { VEHICLE_DETAIL_COLUMNS } from "@/lib/listings";
import { fetchVerifiedSellerName } from "@/lib/stripe-identity";
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
      <dt className="font-mono text-xs uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className="text-black">{children}</dd>
    </div>
  );
}

/** Signed-URL preview for a private document — a PDF gets a "view" link (no
 * inline preview), an image renders directly. Shared by the title photo and
 * the authorization document, both in the same private bucket. */
function DocumentPreview({
  url,
  path,
  alt,
  emptyLabel,
}: {
  url: string | null;
  path: string | null;
  alt: string;
  emptyLabel: string;
}) {
  if (!url) {
    return <p className="mt-1 text-sm text-copper-700">{emptyLabel}</p>;
  }
  if (path?.toLowerCase().endsWith(".pdf")) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-block text-sm text-black underline underline-offset-2"
      >
        View document (PDF) &rarr;
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className="mt-1 h-28 w-40 rounded border border-gray-200 object-cover" />
    </a>
  );
}

export default async function AdminListingReviewPage() {
  const supabase = await createClient();

  // Oldest first — the seller who has waited longest is at the top.
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select(VEHICLE_DETAIL_COLUMNS)
    .eq("status", "pending_review")
    .order("updated_at", { ascending: true });

  const rows = vehicles ?? [];
  const sellerIds = [...new Set(rows.map((v) => v.seller_id))];
  const vehicleIds = rows.map((v) => v.id);

  const [sellersRes, sellerProfilesRes, photosRes] = await Promise.all([
    sellerIds.length
      ? supabase.from("users").select("id, email, phone").in("id", sellerIds)
      : null,
    // The Stripe-Identity-verified legal name, for the side-by-side
    // name-vs-title comparison below — see app/api/stripe/identity/webhook,
    // which now captures verified_outputs' name onto this column. Also
    // pulls id_verification_provider_ref so a seller who was already
    // 'verified' before that webhook change existed can be backfilled below
    // rather than showing "not captured" forever.
    sellerIds.length
      ? supabase
          .from("seller_profiles")
          .select("user_id, full_name, id_verification_status, id_verification_provider_ref")
          .in("user_id", sellerIds)
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

  // Backfill: a seller already 'verified' before the webhook started
  // capturing verified_outputs' name (see lib/stripe-identity.ts) would
  // otherwise show "not captured" forever, since Stripe never re-sends a
  // webhook for a session that already completed. Looked up once here and
  // persisted, so this only ever runs for a given seller until it succeeds.
  const sellerNameById = new Map<string, string | null>();
  for (const p of sellerProfilesRes?.data ?? []) {
    if (
      p.full_name === null &&
      p.id_verification_status === "verified" &&
      p.id_verification_provider_ref
    ) {
      const backfilled = await fetchVerifiedSellerName(p.id_verification_provider_ref);
      if (backfilled) {
        await supabase
          .from("seller_profiles")
          .update({ full_name: backfilled })
          .eq("user_id", p.user_id);
      }
      sellerNameById.set(p.user_id, backfilled);
    } else {
      sellerNameById.set(p.user_id, p.full_name);
    }
  }

  const photosByVehicle = new Map<string, { url: string; is_primary: boolean }[]>();
  for (const p of photosRes?.data ?? []) {
    const list = photosByVehicle.get(p.vehicle_id) ?? [];
    list.push({ url: p.url, is_primary: p.is_primary });
    photosByVehicle.set(p.vehicle_id, list);
  }

  // Signed URLs for title photos (and, since 0031, authorization documents
  // — same private bucket, see components/ui/vehicle-document-uploader.tsx)
  // — the bucket is private (migration 0023), same signed-URL-on-review
  // pattern as bank-transfer proofs.
  const titlePhotoRows = rows.filter((v) => v.title_photo_path);
  const titlePhotoUrlEntries = await Promise.all(
    titlePhotoRows.map(async (v) => {
      const { data } = await supabase.storage
        .from("vehicle-title-photos")
        .createSignedUrl(v.title_photo_path!, 300);
      return [v.id, data?.signedUrl ?? null] as const;
    }),
  );
  const titlePhotoUrlByVehicle = new Map(titlePhotoUrlEntries);

  const authDocRows = rows.filter((v) => v.authorization_document_path);
  const authDocUrlEntries = await Promise.all(
    authDocRows.map(async (v) => {
      const { data } = await supabase.storage
        .from("vehicle-title-photos")
        .createSignedUrl(v.authorization_document_path!, 300);
      return [v.id, data?.signedUrl ?? null] as const;
    }),
  );
  const authDocUrlByVehicle = new Map(authDocUrlEntries);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link
        href="/admin/dashboard"
        className="font-mono text-xs uppercase tracking-wider text-gray-500 hover:text-black"
      >
        &larr; Admin dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-black">Listing review queue</h1>
      <p className="mt-2 text-sm text-gray-500">
        {rows.length === 0
          ? "Nothing waiting for review right now."
          : `${rows.length} listing${rows.length === 1 ? "" : "s"} awaiting review.`}
      </p>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-gray-200 bg-white p-10 text-center">
          <p className="text-black">The queue is clear.</p>
          <p className="mt-1 text-sm text-gray-500">
            New submissions from sellers will show up here.
          </p>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {rows.map((v) => {
            const seller = sellerById.get(v.seller_id);
            const sellerVerifiedName = sellerNameById.get(v.seller_id) ?? null;
            const photos = (photosByVehicle.get(v.id) ?? [])
              .slice()
              .sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
            const titlePhotoUrl = titlePhotoUrlByVehicle.get(v.id) ?? null;
            const authDocUrl = authDocUrlByVehicle.get(v.id) ?? null;

            return (
              <li
                key={v.id}
                className="rounded-lg border border-gray-200 bg-white p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-black">
                      {v.year} {v.make} {v.model}
                      {v.trim ? ` ${v.trim}` : ""}
                    </h2>
                    <p className="mt-1 font-mono text-sm text-gray-500">
                      {usd.format(Number(v.price_usd))} ·{" "}
                      {v.mileage.toLocaleString("en-US")} mi · {v.location_city},{" "}
                      {v.location_state}
                    </p>
                    <p className="mt-1 font-mono text-xs uppercase tracking-wider text-gray-500">
                      VIN {v.vehicle_vin_display}
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
                  <p className="mt-3 whitespace-pre-line text-sm text-gray-500">
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
                          p.is_primary ? "border-black" : "border-gray-200"
                        )}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-copper-700">No photos uploaded.</p>
                )}

                <div className="mt-4 rounded border border-gray-200 p-4">
                  <p className="font-mono text-xs uppercase tracking-wider text-gray-500">
                    Title-ownership review
                  </p>
                  {v.not_titled_owner ? (
                    <p className="mt-1 text-sm text-copper-700">
                      Seller states they are not the titled owner, but are
                      authorized to sell this vehicle.
                    </p>
                  ) : null}

                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-gray-500">
                        Seller&rsquo;s Stripe-Identity-verified legal name
                      </p>
                      <p className="mt-1 text-black">
                        {sellerVerifiedName ?? (
                          <span className="text-copper-700">
                            Not captured — seller hasn&rsquo;t completed identity
                            verification.
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Title document</p>
                      <DocumentPreview
                        url={titlePhotoUrl}
                        path={v.title_photo_path}
                        alt={`Title document for ${v.year} ${v.make} ${v.model}`}
                        emptyLabel="No title document uploaded yet."
                      />
                    </div>
                  </div>

                  {v.not_titled_owner ? (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500">
                        Authorization document (letter / power of attorney)
                      </p>
                      <DocumentPreview
                        url={authDocUrl}
                        path={v.authorization_document_path}
                        alt={`Authorization document for ${v.year} ${v.make} ${v.model}`}
                        emptyLabel="No authorization document uploaded yet."
                      />
                    </div>
                  ) : null}
                </div>

                <ReviewActions
                  vehicleId={v.id}
                  vinVerificationStatus={v.vin_verification_status}
                  titlePhotoPath={v.title_photo_path}
                  titleIdentityMatchConfirmed={v.title_identity_match_confirmed}
                  notTitledOwner={v.not_titled_owner}
                  authorizationDocumentPath={v.authorization_document_path}
                />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
