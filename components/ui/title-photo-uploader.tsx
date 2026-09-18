"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "vehicle-title-photos";
const ACCEPT = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
const MAX_BYTES = 10 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/**
 * Optional title-photo upload on the listing creation form, alongside the
 * photo gallery and walkaround video. Same shape as
 * <BankTransferPayment>'s upload block: the file goes straight into a
 * private bucket under the seller's own session (storage RLS: migration
 * 0023), and the resulting path is handed back to the parent form to submit
 * with the rest of the listing — there's no vehicle_id yet to attach it to
 * server-side at this point, same reason the walkaround video's URL is held
 * in form state until the main insert.
 *
 * Admin reviews it later via a signed URL on /admin/listings — this bucket
 * is private (a title document is sensitive), unlike vehicle-photos/videos.
 */
export function TitlePhotoUploader({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (path: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);

    if (!ACCEPT.includes(file.type as (typeof ACCEPT)[number])) {
      setError(`${file.name}: unsupported format — use JPEG, PNG, WebP, or PDF.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`${file.name}: larger than 10 MB.`);
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
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });
      if (upErr) {
        setError(`Couldn't upload: ${upErr.message}`);
        return;
      }

      onChange(path);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!value) return;
    const path = value;
    onChange(null);
    await createClient().storage.from(BUCKET).remove([path]);
  }

  return (
    <div>
      {value ? (
        <div className="flex items-center justify-between gap-3 rounded border border-verified-100 bg-verified-50 p-3 text-sm text-verified-600">
          <span>Title photo uploaded — MOVA will review it alongside your listing.</span>
          <button
            type="button"
            onClick={() => void remove()}
            className="shrink-0 text-verified-600 hover:text-verified-700"
            aria-label="Remove title photo"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : (
        <label className="flex flex-col gap-2">
          <input
            type="file"
            accept={ACCEPT.join(",")}
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file);
            }}
            className="text-sm text-gray-500 file:mr-3 file:rounded file:border-0 file:bg-black file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
          />
        </label>
      )}

      {busy ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Uploading…
        </p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-copper-700">{error}</p> : null}
    </div>
  );
}
