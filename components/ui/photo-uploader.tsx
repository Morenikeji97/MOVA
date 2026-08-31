"use client";

import { useCallback, useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Star, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type PhotoDraft = {
  /** Object key within the vehicle-photos bucket, e.g. "<uid>/<uuid>.jpg". */
  path: string;
  /** Public URL, saved verbatim into vehicle_photos.url. */
  url: string;
  isPrimary: boolean;
};

const BUCKET = "vehicle-photos";
const ACCEPT = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_BYTES = 10 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type PhotoUploaderProps = {
  value: PhotoDraft[];
  onChange: (next: PhotoDraft[]) => void;
  disabled?: boolean;
  maxPhotos?: number;
  error?: string;
};

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

        for (const file of files.slice(0, Math.max(remaining, 0))) {
          if (!ACCEPT.includes(file.type as (typeof ACCEPT)[number])) {
            errs.push(`${file.name}: unsupported format — use JPEG, PNG or WebP.`);
            continue;
          }
          if (file.size > MAX_BYTES) {
            errs.push(`${file.name}: larger than 10 MB.`);
            continue;
          }

          const path = `${user.id}/${crypto.randomUUID()}.${EXT[file.type]}`;
          const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .upload(path, file, {
              cacheControl: "3600",
              contentType: file.type,
              upsert: false,
            });
          if (upErr) {
            errs.push(`${file.name}: ${upErr.message}`);
            continue;
          }

          const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
          accepted.push({ path, url: data.publicUrl, isPrimary: false });
        }

        if (files.length > remaining) {
          errs.push(`Only ${maxPhotos} photos allowed — extra files were skipped.`);
        }

        setFailures(errs);
        if (accepted.length > 0) onChange(withPrimary([...value, ...accepted]));
      } finally {
        setBusy(false);
      }
    },
    [remaining, maxPhotos, onChange, value],
  );

  async function removeAt(index: number) {
    const target = value[index];
    onChange(withPrimary(value.filter((_, i) => i !== index)));
    // Best-effort cleanup — the vehicle_photos row hasn't been written yet.
    await createClient().storage.from(BUCKET).remove([target.path]);
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

  function pickFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
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
          if (canAdd) pickFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
          dragOver ? "border-marine bg-marine-50" : "border-paper-200 bg-paper-100",
          !canAdd && "opacity-60",
        )}
      >
        <ImagePlus className="h-6 w-6 text-ink-400" aria-hidden />
        <p className="text-sm text-slate-500">
          Drag photos here, or{" "}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={!canAdd}
            className="font-medium text-marine-700 underline underline-offset-2 disabled:no-underline disabled:opacity-60"
          >
            choose files
          </button>
        </p>
        <p className="font-mono text-xs uppercase tracking-wider text-ink-400">
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
          onChange={(e) => {
            const { files } = e.target;
            e.target.value = "";
            pickFiles(files);
          }}
        />
      </div>

      {busy ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Uploading…
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
                "group relative overflow-hidden rounded border bg-paper-100",
                photo.isPrimary ? "border-marine" : "border-paper-200",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={`Vehicle photo ${index + 1}`}
                className="aspect-square w-full object-cover"
                draggable={false}
              />

              {photo.isPrimary ? (
                <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-marine px-2 py-0.5 text-xs font-medium text-white">
                  <Star className="h-3 w-3 fill-current" aria-hidden />
                  Primary
                </span>
              ) : null}

              <button
                type="button"
                onClick={() => removeAt(index)}
                disabled={disabled}
                aria-label={`Remove photo ${index + 1}`}
                className="absolute right-1.5 top-1.5 rounded-full bg-ink-900/70 p-1 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>

              <div className="flex items-center justify-between gap-1 border-t border-paper-200 px-1.5 py-1">
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(index, index - 1)}
                    disabled={disabled || index === 0}
                    aria-label={`Move photo ${index + 1} earlier`}
                    className="rounded p-1 text-ink-400 hover:text-ink-900 disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, index + 1)}
                    disabled={disabled || index === value.length - 1}
                    aria-label={`Move photo ${index + 1} later`}
                    className="rounded p-1 text-ink-400 hover:text-ink-900 disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => makePrimary(index)}
                  disabled={disabled || photo.isPrimary}
                  className="rounded px-1.5 py-0.5 text-xs font-medium text-marine-700 hover:bg-marine-50 disabled:opacity-40"
                >
                  {photo.isPrimary ? "Primary" : "Make primary"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
