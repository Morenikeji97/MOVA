"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PhotoUploader, type PhotoDraft } from "@/components/ui/photo-uploader";
import { Button } from "@/components/ui/button";
import { updateListingPhotos } from "./actions";

export function EditPhotosForm({
  vehicleId,
  initialPhotos,
}: {
  vehicleId: string;
  initialPhotos: PhotoDraft[];
}) {
  const router = useRouter();
  const [photos, setPhotos] = useState<PhotoDraft[]>(initialPhotos);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updateListingPhotos(vehicleId, photos);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <PhotoUploader value={photos} onChange={setPhotos} />

      {error ? <p className="text-sm text-copper-700">{error}</p> : null}
      {saved ? (
        <p className="text-sm text-verified-600">Photos saved.</p>
      ) : null}

      <div>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || photos.length === 0}
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
