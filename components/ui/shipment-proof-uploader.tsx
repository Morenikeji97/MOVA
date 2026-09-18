"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { addProofPhoto } from "@/app/shipper/dashboard/actions";
import type { ShipmentProofKind } from "@/types/database";

const BUCKET = "shipment-proof-photos";
const ACCEPT = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_BYTES = 10 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * One big tap target per kind (pickup/delivery) — no gallery editing, no
 * drag-and-drop, since this only ever needs to answer "is there proof yet."
 * Uploads straight to the private shipment-proof-photos bucket under the
 * shipper's own folder (RLS-required), then records the row.
 */
export function ShipmentProofUploader({
  shipmentId,
  kind,
  label,
}: {
  shipmentId: string;
  kind: ShipmentProofKind;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);

    if (!ACCEPT.includes(file.type as (typeof ACCEPT)[number])) {
      setError("Unsupported format — use JPEG, PNG or WebP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Photo is larger than 10 MB.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Your session has expired. Please sign in again.");
        return;
      }

      const path = `${user.id}/${crypto.randomUUID()}.${EXT[file.type]}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: false });
      if (upErr) {
        setError(upErr.message);
        return;
      }

      const formData = new FormData();
      formData.set("shipmentId", shipmentId);
      formData.set("kind", kind);
      formData.set("storagePath", path);
      await addProofPhoto(formData);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label
        htmlFor={inputId}
        className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded border-2 border-dashed border-gray-200 bg-white text-sm font-medium text-black hover:border-black aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
        aria-disabled={busy}
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        ) : (
          <Camera className="h-5 w-5" aria-hidden />
        )}
        {busy ? "Uploading…" : label}
      </label>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(",")}
        capture="environment"
        disabled={busy}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void handleFile(file);
        }}
      />
      {error ? <p className="mt-2 text-sm text-copper-700">{error}</p> : null}
    </div>
  );
}
