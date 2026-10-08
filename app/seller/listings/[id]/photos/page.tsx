import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PhotoDraft } from "@/components/ui/photo-uploader";
import { SELLER_ARCHIVABLE_STATUSES } from "@/lib/listing-removal";
import { RemoveListingButton } from "../../remove-listing-button";
import { cardClasses } from "@/components/ui/card";
import { BackLink, DashboardHeader, DashboardShell } from "@/components/ui/dashboard";
import { EditPhotosForm } from "./edit-photos-form";

/**
 * A stored vehicle_photos.url is the bucket's public URL
 * (".../storage/v1/object/public/vehicle-photos/<path>") — PhotoUploader's
 * remove/reorder logic needs the bare object path (everything after the
 * bucket name) to call storage.remove(). Defensive fallback to the full URL
 * if the marker isn't found, so a malformed row doesn't crash the page.
 */
function pathFromPublicUrl(url: string): string {
  const marker = "/vehicle-photos/";
  const index = url.indexOf(marker);
  return index === -1 ? url : url.slice(index + marker.length);
}

export default async function EditListingPhotosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS ("vehicles seller update own" / read policies) confines this to the
  // seller's own listings regardless, but a friendly 404 beats an empty page.
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, seller_id, status, year, make, model, trim")
    .eq("id", id)
    .maybeSingle();
  if (!vehicle || vehicle.seller_id !== user!.id) notFound();

  const { data: photoRows } = await supabase
    .from("vehicle_photos")
    .select("url, thumb_url, sort_order, is_primary")
    .eq("vehicle_id", id)
    .order("sort_order", { ascending: true });

  const initialPhotos: PhotoDraft[] = (photoRows ?? []).map((row) => ({
    path: pathFromPublicUrl(row.url),
    url: row.url,
    ...(row.thumb_url
      ? { thumbPath: pathFromPublicUrl(row.thumb_url), thumbUrl: row.thumb_url }
      : {}),
    isPrimary: row.is_primary,
  }));

  const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}${
    vehicle.trim ? ` ${vehicle.trim}` : ""
  }`;

  return (
    <DashboardShell narrow>
      <BackLink href="/seller/listings">My listings</BackLink>
      <DashboardHeader className="mt-2" title="Edit photos" intro={title} />

      <div className={cardClasses({ className: "mt-6" })}>
        <EditPhotosForm vehicleId={vehicle.id} initialPhotos={initialPhotos} />
      </div>

      {SELLER_ARCHIVABLE_STATUSES.includes(vehicle.status) ? (
        <section className={cardClasses({ className: "mt-6" })}>
          <h2 className="font-display text-lg font-bold text-ink">Remove this listing</h2>
          <p className="mt-1 text-sm text-muted">
            Takes the car off ShipMova. Use this if it&rsquo;s sold elsewhere or you
            no longer want it listed.
          </p>
          <RemoveListingButton
            vehicleId={vehicle.id}
            isLive={vehicle.status === "approved"}
            className="mt-4"
          />
        </section>
      ) : null}
    </DashboardShell>
  );
}
