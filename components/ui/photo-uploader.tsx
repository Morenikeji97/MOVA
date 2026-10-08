"use client";

import { useCallback, useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Star, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { mediaUrl } from "@/lib/media-url";
import { resizePhoto } from "@/lib/image-resize";
import { buttonClasses } from "@/components/ui/button";
import { takeFiles } from "@/lib/file-input";

export type PhotoDraft = {
  /** Object key within the vehicle-photos bucket, e.g. "<uid>/<uuid>.webp". */
  path: string;
  /** Public URL, saved verbatim into vehicle_photos.url. */
  url: string;
  /** The ≈480px thumbnail ("<uid>/<uuid>-thumb.webp"). Absent for photos
   * uploaded before resizing existed (migration 0049). */
  thumbPath?: string;
  /** Public URL, saved into vehicle_photos.thumb_url. */
  thumbUrl?: string;
  isPrimary: boolean;
};

const BUCKET = "vehicle-photos";
const ACCEPT = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_BYTES = 10 * 1024 * 1024;
// Every object name is a fresh UUID, so a stored file never changes.
const CACHE_SECONDS = "31536000";

type PhotoUploaderProps = {
  value: PhotoDraft[];
  onChange: (next: PhotoDraft[]) => void;
  disabled?: boolean;
  maxPhotos?: number;
  error?: string;
};

function isHeic(file: File): boolean {
  return /^image\/hei[cf]/.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

/** Keeps exactly one primary whenever the list is non-empty (first by default). */
function withPrimary(list: PhotoDraft[]): PhotoDraft[] {
  if (list.length === 0) return list;
  const hasPrimary = list.some((p) => p.isPrimary);
  return list.map((p, i) => ({ ...p, isPrimary: hasPrimary ? p.isPrimary : i === 0 }));
}

export function PhotoUploader({
  value,
  onChange,
  disabled,
  maxPhotos = 20,
  error,
}: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragIndex = useRef<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [failures, setFailures] = useState<string[]>([]);
  const inputId = useId();

  const remaining = maxPhotos - value.length;
  const canAdd = !disabled && !busy && remaining > 0;

  const upload = useCallback(
    async (files: File[]) => {
      setFailures([]);
      setBusy(true);
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setFailures(["Your session has expired. Please sign in again."]);
          return;
        }

        const errs: string[] = [];
        const accepted: PhotoDraft[] = [];

        const batch = files.slice(0, Math.max(remaining, 0));
        for (const [i, file] of batch.entries()) {
          setProgress({ done: i, total: batch.length });
          if (isHeic(file)) {
            // iPhone's photo picker converts to JPEG for us; a HEIC only
            // arrives from a computer, and only Safari can decode it.
            errs.push(`${file.name}: HEIC photos aren't supported — export it as JPEG and try again.`);
            continue;
          }
          if (!ACCEPT.includes(file.type as (typeof ACCEPT)[number])) {
            errs.push(`${file.name}: unsupported format — use JPEG, PNG or WebP.`);
            continue;
          }
          if (file.size > MAX_BYTES) {
            errs.push(`${file.name}: larger than 10 MB.`);
            continue;
          }

          // Shrink before upload: ≈1600px for the gallery, ≈480px for cards
          // (lib/image-resize.ts). The original never leaves the phone.
          let resized;
          try {
            resized = await resizePhoto(file);
          } catch {
            errs.push(`${file.name}: couldn't read this photo — try saving it as a JPEG.`);
            continue;
          }

          const id = crypto.randomUUID();
          const path = `${user.id}/${id}.${resized.full.ext}`;
          const thumbPath = `${user.id}/${id}-thumb.${resized.thumb.ext}`;
          const bucket = supabase.storage.from(BUCKET);

          try {
            const { error: upErr } = await bucket.upload(path, resized.full.blob, {
              cacheControl: CACHE_SECONDS,
              contentType: resized.full.type,
              upsert: false,
            });
            if (upErr) {
              errs.push(`${file.name}: ${upErr.message}`);
              continue;
            }
            const { error: thumbErr } = await bucket.upload(thumbPath, resized.thumb.blob, {
              cacheControl: CACHE_SECONDS,
              contentType: resized.thumb.type,
              upsert: false,
            });
            if (thumbErr) {
              await bucket.remove([path]);
              errs.push(`${file.name}: ${thumbErr.message}`);
              continue;
            }
          } catch {
            // A dropped connection rejects instead of returning an error.
            errs.push(`${file.name}: upload failed — check your connection and try again.`);
            continue;
          }

          accepted.push({
            path,
            url: bucket.getPublicUrl(path).data.publicUrl,
            thumbPath,
            thumbUrl: bucket.getPublicUrl(thumbPath).data.publicUrl,
            isPrimary: false,
          });
        }

        if (files.length > remaining) {
          errs.push(`Only ${maxPhotos} photos allowed — extra files were skipped.`);
        }

        setFailures(errs);
        if (accepted.length > 0) onChange(withPrimary([...value, ...accepted]));
      } catch {
        // Nothing may fail silently: a picked photo either appears or explains itself.
        setFailures(["Something went wrong uploading your photos. Please try again."]);
      } finally {
        setBusy(false);
        setProgress(null);
      }
    },
    [remaining, maxPhotos, onChange, value],
  );

  async function removeAt(index: number) {
    const target = value[index];
    onChange(withPrimary(value.filter((_, i) => i !== index)));
    // Best-effort cleanup — the vehicle_photos row hasn't been written yet.
    const paths = target.thumbPath ? [target.path, target.thumbPath] : [target.path];
    await createClient().storage.from(BUCKET).remove(paths);
  }

  function makePrimary(index: number) {
    onChange(value.map((p, i) => ({ ...p, isPrimary: i === index })));
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= value.length || from === to) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  }

  function pickFiles(files: File[]) {
    if (files.length) void upload(files);
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (canAdd) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (canAdd) pickFiles(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
          dragOver ? "border-ink bg-band" : "border-line bg-white",
          !canAdd && "opacity-60",
        )}
      >
        <ImagePlus className="h-6 w-6 text-muted" aria-hidden />
        <p className="text-sm text-muted [@media(hover:none)]:hidden">Drag photos here, or</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!canAdd}
          className={buttonClasses({ variant: "secondary" })}
        >
          Choose photos
        </button>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          JPEG, PNG or WebP · up to 10 MB · {value.length}/{maxPhotos} added
        </p>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={ACCEPT.join(",")}
          multiple
          className="sr-only"
          disabled={!canAdd}
          onChange={(e) => pickFiles(takeFiles(e.target))}
        />
      </div>

      {busy ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {progress && progress.total > 1
            ? `Uploading photo ${progress.done + 1} of ${progress.total}…`
            : "Uploading…"}
        </p>
      ) : null}

      {failures.map((f) => (
        <p key={f} className="text-sm text-copper-700">
          {f}
        </p>
      ))}
      {error ? <p className="text-sm text-copper-700">{error}</p> : null}

      {value.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {value.map((photo, index) => (
            <li
              key={photo.path}
              draggable={!disabled}
              onDragStart={() => {
                dragIndex.current = index;
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dragIndex.current !== null) move(dragIndex.current, index);
                dragIndex.current = null;
              }}
              className={cn(
                "group relative overflow-hidden rounded-lg border bg-white",
                photo.isPrimary ? "border-ink" : "border-line",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaUrl(photo.thumbUrl ?? photo.url)}
                alt={`Vehicle photo ${index + 1}`}
                loading="lazy"
                decoding="async"
                className="aspect-square w-full object-cover"
                draggable={false}
              />

              {photo.isPrimary ? (
                <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-xs font-medium text-white">
                  <Star className="h-3 w-3 fill-current" aria-hidden />
                  Primary
                </span>
              ) : null}

              {/* 44px tap area around a small visible circle. Always shown on
                  touch screens, which have no hover (architecture review §1.3). */}
              <button
                type="button"
                onClick={() => removeAt(index)}
                disabled={disabled}
                aria-label={`Remove photo ${index + 1}`}
                className="absolute right-0 top-0 flex h-11 w-11 items-start justify-end p-1.5 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
              >
                <span className="rounded-full bg-ink/70 p-1 text-white">
                  <X className="h-4 w-4" aria-hidden />
                </span>
              </button>

              <div className="flex items-center justify-between gap-1 border-t border-line px-0.5">
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(index, index - 1)}
                    disabled={disabled || index === 0}
                    aria-label={`Move photo ${index + 1} earlier`}
                    className="flex h-11 w-11 items-center justify-center rounded text-muted hover:text-ink disabled:opacity-30"
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, index + 1)}
                    disabled={disabled || index === value.length - 1}
                    aria-label={`Move photo ${index + 1} later`}
                    className="flex h-11 w-11 items-center justify-center rounded text-muted hover:text-ink disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => makePrimary(index)}
                  disabled={disabled || photo.isPrimary}
                  aria-label={
                    photo.isPrimary
                      ? `Photo ${index + 1} is the cover photo`
                      : `Make photo ${index + 1} the cover photo`
                  }
                  title={photo.isPrimary ? "Cover photo" : "Make cover photo"}
                  className="flex h-11 w-11 items-center justify-center rounded text-ink hover:bg-band disabled:hover:bg-transparent"
                >
                  <Star
                    className={cn("h-4 w-4", photo.isPrimary && "fill-current")}
                    aria-hidden
                  />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
