"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ActionForm, useActionPending } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input-classes";
import { resizePhoto } from "@/lib/image-resize";
import { takeFiles } from "@/lib/file-input";
import { SHIPPER_INSURANCE_BUCKET } from "@/lib/shipper-verification";
import { submitShipperCoi } from "../insurance-actions";

const MAX_PDF_BYTES = 10 * 1024 * 1024;

function Submit() {
  const pending = useActionPending();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Sending…" : "Send certificate for review"}
    </Button>
  );
}

/** Upload a marine-cargo insurance certificate (PDF or photo) and its details. */
export function InsuranceForm({ userId }: { userId: string }) {
  const [path, setPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function upload(files: File[]) {
    const file = files[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      let body: Blob;
      let type: string;
      let ext: string;
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        if (file.size > MAX_PDF_BYTES) throw new Error("too big");
        body = file;
        type = "application/pdf";
        ext = "pdf";
      } else {
        const { full } = await resizePhoto(file);
        body = full.blob;
        type = full.type;
        ext = full.ext;
      }
      const objectPath = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await createClient()
        .storage.from(SHIPPER_INSURANCE_BUCKET)
        .upload(objectPath, body, { contentType: type, upsert: false });
      if (error) throw error;
      setPath(objectPath);
    } catch (err) {
      console.error("COI upload failed:", err);
      setPath(null);
      setUploadError("Your certificate didn't upload. Use a PDF under 10 MB, or a clear JPEG/PNG photo, and try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <ActionForm action={submitShipperCoi} className="mt-4 flex flex-col gap-4">
      <input type="hidden" name="document_path" value={path ?? ""} />
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">Certificate of insurance (PDF or photo)</span>
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          onChange={(e) => void upload(takeFiles(e.target))}
          className="text-base text-ink file:mr-3 file:h-11 file:rounded-lg file:border-0 file:bg-ink file:px-4 file:text-white"
        />
      </label>
      {uploading ? <p className="text-sm text-muted">Uploading…</p> : null}
      {path && !uploading ? <p className="text-sm text-verified-600">Certificate ready.</p> : null}
      {uploadError ? <p className="text-sm text-copper-700">{uploadError}</p> : null}
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">Insurance company</span>
        <input name="insurer" required maxLength={200} autoComplete="organization" className={inputClasses()} />
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">Cargo cover limit (US$ per shipment)</span>
          <input name="cargo_limit_usd" required inputMode="numeric" placeholder="50000" autoComplete="off" className={inputClasses()} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">Expiry date</span>
          <input name="expires_on" type="date" required className={inputClasses()} />
        </label>
      </div>
      <Submit />
    </ActionForm>
  );
}
