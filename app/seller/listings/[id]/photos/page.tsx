import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PhotoDraft } from "@/components/ui/photo-uploader";
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
    .select("id, seller_id, year, make, model, trim")
    .eq("id", id)
    .maybeSingle();
  if (!vehicle || vehicle.seller_id !== user!.id) notFound();

  const { data: photoRows } = await supabase
    .from("vehicle_photos")
    .select("url, sort_order, is_primary")
    .eq("vehicle_id", id)
    .order("sort_order", { ascending: true });

  const initialPhotos: PhotoDraft[] = (photoRows ?? []).map((row) => ({
    path: pathFromPublicUrl(row.url),
    url: row.url,
    isPrimary: row.is_primary,
  }));

  const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}${
    vehicle.trim ? ` ${vehicle.trim}` : ""
  }`;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link
        href="/seller/listings"
        className="font-mono text-xs uppercase tracking-wider text-ink-400 hover:text-ink-900"
      >
        &larr; My listings
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-ink-900">Edit photos</h1>
      <p className="mt-1 text-slate-500">{title}</p>

      <div className="mt-8">
        <EditPhotosForm vehicleId={vehicle.id} initialPhotos={initialPhotos} />
      </div>
    </main>
  );
}
