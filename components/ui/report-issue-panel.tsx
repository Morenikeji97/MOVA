"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { fileDispute } from "@/app/disputes/actions";
import {
  DISPUTE_CATEGORIES,
  DISPUTE_CATEGORY_LABEL,
  DISPUTE_EVIDENCE_ACCEPT,
  DISPUTE_EVIDENCE_BUCKET,
  DISPUTE_EVIDENCE_EXT,
  DISPUTE_EVIDENCE_MAX_BYTES,
  DISPUTE_EVIDENCE_MAX_FILES,
} from "@/lib/disputes";
import type { DisputeCategory } from "@/types/database";

/**
 * "Report an issue" — collapsed to a single button until clicked, then the
 * filing form (category, description, optional evidence). Identical on the
 * buyer dashboard and the seller reservations page; the only thing that
 * differs by caller is which reservation it's attached to.
 */
export function ReportIssuePanel({ purchaseRequestId }: { purchaseRequestId: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<DisputeCategory>(DISPUTE_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function addFiles(list: FileList | null) {
    const picked = Array.from(list ?? []);
    if (picked.length === 0) return;
    setError(null);

    const accepted: File[] = [];
    for (const file of picked) {
      if (files.length + accepted.length >= DISPUTE_EVIDENCE_MAX_FILES) {
        setError(`Only ${DISPUTE_EVIDENCE_MAX_FILES} files allowed — extra files were skipped.`);
        break;
      }
      if (!DISPUTE_EVIDENCE_ACCEPT.includes(file.type as (typeof DISPUTE_EVIDENCE_ACCEPT)[number])) {
        setError(`${file.name}: unsupported format — use JPEG, PNG, WebP, or PDF.`);
        continue;
      }
      if (file.size > DISPUTE_EVIDENCE_MAX_BYTES) {
        setError(`${file.name}: larger than 10 MB.`);
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length > 0) setFiles((prev) => [...prev, ...accepted]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = description.trim();
    if (trimmed.length === 0) {
      setError("Please describe the issue.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Your session has expired. Please sign in again.");
        return;
      }

      const paths: string[] = [];
      if (files.length > 0) {
        setUploading(true);
        for (const file of files) {
          const path = `${user.id}/${crypto.randomUUID()}.${DISPUTE_EVIDENCE_EXT[file.type]}`;
          const { error: upErr } = await supabase.storage
            .from(DISPUTE_EVIDENCE_BUCKET)
            .upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: false });
          if (upErr) {
            setError(`Couldn't upload ${file.name}: ${upErr.message}`);
            setUploading(false);
            return;
          }
          paths.push(path);
        }
        setUploading(false);
      }

      const res = await fileDispute(purchaseRequestId, category, trimmed, paths);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <p className="mt-3 rounded border border-verified-100 bg-verified-50 p-3 text-sm text-verified-600">
        Dispute filed — MOVA will review it, usually within 5 business days.
      </p>
    );
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-3"
        onClick={() => setOpen(true)}
      >
        Report an issue
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 flex flex-col gap-3 rounded border border-gray-200 bg-white p-4"
    >
      <p className="text-sm font-medium text-black">Report an issue</p>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-500">Category</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as DisputeCategory)}
          className="h-11 rounded border border-gray-200 bg-white px-3 text-sm text-black"
        >
          {DISPUTE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {DISPUTE_CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-500">
          Description <span className="text-copper-700">*</span>
        </span>
        <textarea
          required
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What happened? Include dates, amounts, and anything relevant."
          className="rounded border border-gray-200 bg-white px-3 py-2 text-sm text-black"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-500">
          Evidence (optional) — photos or screenshots
        </span>
        <input
          type="file"
          multiple
          accept={DISPUTE_EVIDENCE_ACCEPT.join(",")}
          disabled={files.length >= DISPUTE_EVIDENCE_MAX_FILES}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
          className="text-sm text-gray-500 file:mr-3 file:rounded file:border-0 file:bg-black file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
        />
        <span className="font-mono text-xs uppercase tracking-wider text-gray-500">
          JPEG, PNG, WebP, or PDF · up to 10 MB each · up to {DISPUTE_EVIDENCE_MAX_FILES} files
        </span>
      </label>

      {files.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between gap-2 text-sm text-black"
            >
              <span className="truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="shrink-0 text-xs text-black hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="text-sm text-copper-700">{error}</p> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={submitting}>
          {uploading ? "Uploading…" : submitting ? "Filing…" : "Submit dispute"}
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={submitting}
          className="text-sm text-gray-500 hover:text-black"
        >
          Cancel
        </button>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin text-gray-500" aria-hidden /> : null}
      </div>
    </form>
  );
}
