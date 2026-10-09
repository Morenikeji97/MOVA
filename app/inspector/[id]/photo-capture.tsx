"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resizePhoto } from "@/lib/image-resize";
import { takeFiles } from "@/lib/file-input";
import { addInspectionPhoto } from "../actions";

const BUCKET = "inspection-photos";

function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("no geolocation"));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  });
}

/**
 * Takes one inspection photo with the phone's location at that moment.
 * Without location there's no upload — the location is what proves the
 * photo was taken at the car (iPhone Safari strips GPS from photo files).
 */
export function PhotoCapture({
  userId,
  inspectionId,
  kind,
  label,
}: {
  userId: string;
  inspectionId: string;
  kind: "vin" | "odometer" | "title" | "car";
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function take(files: File[]) {
    const file = files[0];
    if (!file) return;
    setError(null);
    try {
      setBusy("Getting your location…");
      let pos: GeolocationPosition;
      try {
        pos = await currentPosition();
      } catch {
        setError("Allow location for ShipMova, then take the photo again — inspection photos need the place they were taken.");
        return;
      }
      setBusy("Uploading…");
      const { full } = await resizePhoto(file);
      const path = `${userId}/${inspectionId}/${crypto.randomUUID()}.${full.ext}`;
      const { error: upErr } = await createClient().storage.from(BUCKET).upload(path, full.blob, { contentType: full.type, upsert: false });
      if (upErr) throw upErr;
      const fd = new FormData();
      fd.set("inspection_id", inspectionId);
      fd.set("kind", kind);
      fd.set("storage_path", path);
      fd.set("latitude", String(pos.coords.latitude));
      fd.set("longitude", String(pos.coords.longitude));
      fd.set("accuracy_m", String(Math.round(pos.coords.accuracy)));
      fd.set("captured_at", new Date(pos.timestamp).toISOString());
      const res = await addInspectionPhoto(fd);
      if (!res || !res.ok) {
        setError(res?.message ?? "The photo wasn't recorded. Try again.");
        return;
      }
      router.refresh();
    } catch (err) {
      console.error("inspection photo failed:", err);
      setError("The photo didn't upload. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-lg bg-ink px-4 font-semibold text-white sm:w-auto">
        {busy ?? label}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={busy !== null}
          onChange={(e) => void take(takeFiles(e.target))}
        />
      </label>
      {error ? <p role="alert" className="text-sm text-copper-700">{error}</p> : null}
    </div>
  );
}
