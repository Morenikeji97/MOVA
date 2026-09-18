"use client";

import { useCallback, useId, useRef, useState } from "react";
import { Loader2, VideoIcon, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type VideoDraft = {
  /** Object key within the vehicle-videos bucket, e.g. "<uid>/<uuid>.mp4". */
  path: string;
  /** Public URL, saved verbatim into vehicle_videos.url. */
  url: string;
  /** Client-read duration, in seconds. Advisory only — see migration 0012. */
  durationSeconds: number | null;
};

const BUCKET = "vehicle-videos";
const ACCEPT = "video/mp4";
const MAX_BYTES = 100 * 1024 * 1024;
const MAX_DURATION_SECONDS = 90;

/** Reads a video file's duration by loading its metadata off-DOM. */
function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this video file."));
    };
    video.src = url;
  });
}

type VideoUploaderProps = {
  value: VideoDraft | null;
  onChange: (next: VideoDraft | null) => void;
  disabled?: boolean;
  error?: string;
};

/**
 * Single-video uploader for a listing — at most one video, mp4 only, up to
 * 100 MB and 90 seconds. Format and size are re-checked server-side by the
 * vehicle-videos bucket's own limits (migration 0012); duration has no
 * server-side equivalent, so it's enforced here, before upload starts.
 */
export function VideoUploader({ value, onChange, disabled, error }: VideoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const inputId = useId();

  const canAdd = !disabled && !busy && !value;

  const upload = useCallback(
    async (file: File) => {
      setFailure(null);

      if (file.type !== ACCEPT) {
        setFailure(`${file.name}: unsupported format — MP4 only.`);
        return;
      }
      if (file.size > MAX_BYTES) {
        setFailure(`${file.name}: larger than 100 MB.`);
        return;
      }

      setBusy(true);
      try {
        let duration: number;
        try {
          duration = await readDuration(file);
        } catch {
          setFailure(`${file.name}: could not read this video file.`);
          return;
        }
        if (Number.isFinite(duration) && duration > MAX_DURATION_SECONDS) {
          setFailure(
            `${file.name}: ${Math.round(duration)}s long — videos must be ${MAX_DURATION_SECONDS}s or shorter.`,
          );
          return;
        }

        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setFailure("Your session has expired. Please sign in again.");
          return;
        }

        const path = `${user.id}/${crypto.randomUUID()}.mp4`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, {
            cacheControl: "3600",
            contentType: file.type,
            upsert: false,
          });
        if (upErr) {
          setFailure(`${file.name}: ${upErr.message}`);
          return;
        }

        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        onChange({
          path,
          url: data.publicUrl,
          durationSeconds: Number.isFinite(duration) ? Math.round(duration) : null,
        });
      } finally {
        setBusy(false);
      }
    },
    [onChange],
  );

  async function remove() {
    if (!value) return;
    const target = value;
    onChange(null);
    // Best-effort cleanup — the vehicle_videos row hasn't been written yet.
    await createClient().storage.from(BUCKET).remove([target.path]);
  }

  function pickFile(list: FileList | null) {
    const file = list?.[0];
    if (file) void upload(file);
  }

  return (
    <div className="flex flex-col gap-3">
      {!value ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (canAdd) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (canAdd) pickFile(e.dataTransfer.files);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
            dragOver ? "border-black bg-gray-100" : "border-gray-200 bg-white",
            !canAdd && "opacity-60",
          )}
        >
          <VideoIcon className="h-6 w-6 text-gray-500" aria-hidden />
          <p className="text-sm text-gray-500">
            Drag a video here, or{" "}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={!canAdd}
              className="font-medium text-black underline underline-offset-2 disabled:no-underline disabled:opacity-60"
            >
              choose a file
            </button>
          </p>
          <p className="font-mono text-xs uppercase tracking-wider text-gray-500">
            MP4 only · up to 100 MB · up to {MAX_DURATION_SECONDS}s
          </p>
          <input
            id={inputId}
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            disabled={!canAdd}
            onChange={(e) => {
              const { files } = e.target;
              e.target.value = "";
              pickFile(files);
            }}
          />
        </div>
      ) : (
        <div className="relative overflow-hidden rounded border border-gray-200 bg-white">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={value.url}
            controls
            className="aspect-video w-full bg-black object-contain"
          />
          <button
            type="button"
            onClick={remove}
            disabled={disabled}
            aria-label="Remove video"
            className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-white transition-opacity hover:bg-black"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}

      {busy ? (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Uploading…
        </p>
      ) : null}

      {failure ? <p className="text-sm text-copper-700">{failure}</p> : null}
      {error ? <p className="text-sm text-copper-700">{error}</p> : null}
    </div>
  );
}
