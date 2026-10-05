"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ActionForm, useActionPending } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input-classes";
import { ID_COUNTRIES, type IdCountry } from "@/lib/id-verification";
import { resizePhoto } from "@/lib/image-resize";
import { takeFiles } from "@/lib/file-input";
import { submitIdDocument, verifyBuyerId } from "./actions";

const BUCKET = "buyer-id-documents";

function SubmitButton({ children }: { children: React.ReactNode }) {
  const pending = useActionPending();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Checking…" : children}
    </Button>
  );
}

function NameField() {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-gray-500">Full legal name, as on your ID</span>
      <input name="legal_name" required autoComplete="name" className={inputClasses()} />
    </label>
  );
}

/** Where the "opens at launch" refusal points: the waitlist. */
function WaitlistHint() {
  return (
    <p className="text-sm text-gray-500">
      <Link href="/waitlist" className="underline">
        Join the waitlist
      </Link>{" "}
      and we&rsquo;ll tell you the moment ID verification opens.
    </p>
  );
}

export function VerifyIdForm({
  userId,
  defaultCountry,
  live,
}: {
  userId: string;
  defaultCountry: IdCountry | null;
  /** Dojah live: no waitlist hint. */
  live: boolean;
}) {
  const [country, setCountry] = useState<IdCountry | "">(defaultCountry ?? "");
  const selected = ID_COUNTRIES.find((c) => c.code === country) ?? null;

  return (
    <div className="mt-6 flex flex-col gap-5">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-500">Your country</span>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value as IdCountry)}
          className={inputClasses()}
        >
          <option value="" disabled>
            Choose…
          </option>
          {ID_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {selected && selected.method !== "document" ? (
        <ActionForm action={verifyBuyerId} className="flex flex-col gap-4">
          <input type="hidden" name="country" value={selected.code} />
          <NameField />
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500">{selected.idLabel}</span>
            <input
              name="id_number"
              required
              autoComplete="off"
              inputMode={selected.method === "ng_nin" ? "numeric" : "text"}
              placeholder={selected.method === "ng_nin" ? "11 digits" : "GHA-123456789-0"}
              className={inputClasses({ className: "font-mono" })}
            />
          </label>
          <SubmitButton>Verify my {selected.idLabel}</SubmitButton>
          {live ? null : <WaitlistHint />}
        </ActionForm>
      ) : null}

      {selected && selected.method === "document" ? (
        <DocumentForm userId={userId} country={selected.code} />
      ) : null}
    </div>
  );
}

function DocumentForm({ userId, country }: { userId: string; country: IdCountry }) {
  const [path, setPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function upload(files: File[]) {
    const file = files[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const { full } = await resizePhoto(file);
      const objectPath = `${userId}/${crypto.randomUUID()}.${full.ext}`;
      const { error } = await createClient()
        .storage.from(BUCKET)
        .upload(objectPath, full.blob, { contentType: full.type, upsert: false });
      if (error) throw error;
      setPath(objectPath);
    } catch (err) {
      console.error("ID photo upload failed:", err);
      setPath(null);
      setUploadError("Your photo didn't upload. Use a clear JPEG or PNG photo and try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <ActionForm action={submitIdDocument} className="flex flex-col gap-4">
      <input type="hidden" name="country" value={country} />
      <input type="hidden" name="document_path" value={path ?? ""} />
      <NameField />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm text-gray-500">Which ID?</legend>
        <label className="flex h-11 items-center gap-3 text-black">
          <input type="radio" name="document_type" value="national_id" required className="h-5 w-5" />
          National ID card
        </label>
        <label className="flex h-11 items-center gap-3 text-black">
          <input type="radio" name="document_type" value="passport" className="h-5 w-5" />
          Passport
        </label>
      </fieldset>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-500">
          Photo of the ID (the page with your photo and name). It&rsquo;s private and deleted once
          ShipMova has checked it.
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => void upload(takeFiles(e.target))}
          className="text-base text-black file:mr-3 file:h-11 file:rounded file:border-0 file:bg-black file:px-4 file:text-white"
        />
      </label>
      {uploading ? <p className="text-sm text-gray-500">Uploading your photo…</p> : null}
      {path && !uploading ? <p className="text-sm text-verified-600">Photo ready.</p> : null}
      {uploadError ? <p className="text-sm text-copper-700">{uploadError}</p> : null}
      <SubmitButton>Send for review</SubmitButton>
    </ActionForm>
  );
}
