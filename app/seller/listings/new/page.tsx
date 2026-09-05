"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { VinData } from "@/components/ui/vin-data";
import { PhotoUploader, type PhotoDraft } from "@/components/ui/photo-uploader";

const MAX_PHOTOS = 20;

const MAX_YEAR = new Date().getFullYear() + 1;
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

// NHTSA's free vPIC VIN decoder. Sends CORS headers, so it's safe to call
// straight from the browser. https://vpic.nhtsa.dot.gov/api/
const NHTSA_DECODE_URL =
  "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues";

type DecodedVin = {
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
};

type NhtsaResult = Record<string, string>;

const TRANSMISSIONS = ["Automatic", "Manual", "CVT", "Dual-clutch", "Other"] as const;
const FUEL_TYPES = [
  "Gasoline",
  "Diesel",
  "Hybrid",
  "Plug-in hybrid",
  "Electric",
  "Flex fuel",
  "Other",
] as const;
const CONDITIONS = ["Excellent", "Very good", "Good", "Fair", "Poor"] as const;
const ACCIDENT_HISTORY = [
  "None reported",
  "Minor damage",
  "Moderate damage",
  "Severe damage",
  "Unknown",
] as const;
const TITLE_STATUSES = ["Clean", "Salvage", "Rebuilt", "Flood", "Lemon / buyback", "Other"] as const;

const US_STATES: ReadonlyArray<readonly [string, string]> = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
  ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"],
  ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"],
  ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"],
  ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"],
  ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
  ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"],
  ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"],
  ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"],
  ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
  ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
];

const schema = z.object({
  vin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(VIN_RE, "Enter a valid 17-character VIN (letters and numbers, no I, O or Q)."),
  year: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Enter the 4-digit model year.")
    .refine(
      (v) => Number(v) >= 1900 && Number(v) <= MAX_YEAR,
      `Year must be between 1900 and ${MAX_YEAR}.`,
    ),
  make: z.string().trim().min(1, "Make is required.").max(60),
  model: z.string().trim().min(1, "Model is required.").max(60),
  trim: z.string().trim().max(60),
  mileage: z
    .string()
    .trim()
    .regex(/^\d{1,7}$/, "Enter the mileage as a whole number.")
    .refine((v) => Number(v) <= 1_000_000, "Mileage looks too high."),
  exterior_color: z.string().trim().max(40),
  interior_color: z.string().trim().max(40),
  transmission: z.string().trim().max(40),
  fuel_type: z.string().trim().max(40),
  condition: z.string().trim().max(40),
  accident_history: z.string().trim().max(40),
  title_status: z.string().trim().max(40),
  location_city: z.string().trim().min(1, "City is required.").max(80),
  location_state: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Select the state where the vehicle is located."),
  price_usd: z
    .string()
    .trim()
    .regex(/^\d{1,9}(\.\d{1,2})?$/, "Enter the asking price, e.g. 14500.")
    .refine(
      (v) => Number(v) > 0 && Number(v) <= 5_000_000,
      "Price must be between 1 and 5,000,000.",
    ),
  description: z.string().trim().max(5000),
  fee_responsibility: z.enum(["buyer_pays_full", "split"]),
  photos: z
    .array(
      z.object({
        path: z.string().min(1),
        url: z.string().url(),
        isPrimary: z.boolean(),
      }),
    )
    .max(MAX_PHOTOS, `You can add up to ${MAX_PHOTOS} photos.`)
    .superRefine((photos, ctx) => {
      if (photos.length > 0 && photos.filter((p) => p.isPrimary).length !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Choose exactly one primary photo.",
        });
      }
    }),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  vin: "",
  year: "",
  make: "",
  model: "",
  trim: "",
  mileage: "",
  exterior_color: "",
  interior_color: "",
  transmission: "",
  fuel_type: "",
  condition: "",
  accident_history: "",
  title_status: "",
  location_city: "",
  location_state: "",
  price_usd: "",
  description: "",
  fee_responsibility: "buyer_pays_full",
  photos: [],
};

const inputClass = "h-11 rounded border border-paper-200 bg-paper-100 px-3 text-ink-900";

/** Trims a form string, returning null for empty values so the column stays NULL. */
function orNull(value: string): string | null {
  const v = value.trim();
  return v.length > 0 ? v : null;
}

function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("font-mono text-xs uppercase tracking-wider text-ink-400", className)}>
      {children}
    </p>
  );
}

function Field({
  label,
  error,
  optional,
  children,
  className,
}: {
  label: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-sm text-slate-500">
        {label}
        {optional ? <span className="text-ink-400"> (optional)</span> : null}
      </span>
      {children}
      {error ? <span className="text-sm text-copper-700">{error}</span> : null}
    </label>
  );
}

export default function NewListingPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  const [vinDecoded, setVinDecoded] = useState<DecodedVin | null>(null);
  const [vinDecoding, setVinDecoding] = useState(false);
  const [vinError, setVinError] = useState<string | null>(null);

  // Guards against a double-click or slow-network second submit creating a
  // duplicate listing. `isSubmitting` from react-hook-form clears the moment
  // onSubmit returns, which is before the client-side navigation finishes, so
  // it isn't enough on its own. The ref blocks re-entrant calls synchronously;
  // `saving` drives the disabled/label state and is intentionally left set on
  // the success path (the page unmounts on navigation).
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);

  const vinValue = watch("vin");
  const enteredYear = watch("year");
  const enteredMake = watch("make");
  const enteredModel = watch("model");
  const photos = watch("photos");

  // A decoded result only describes the VIN it was fetched for; drop it as
  // soon as the seller edits the VIN field again.
  useEffect(() => {
    setVinDecoded(null);
    setVinError(null);
  }, [vinValue]);

  async function handleDecodeVin() {
    const vin = getValues("vin").trim().toUpperCase();
    if (!VIN_RE.test(vin)) {
      setVinDecoded(null);
      setVinError("Enter a valid 17-character VIN before decoding.");
      return;
    }

    setVinDecoding(true);
    setVinError(null);
    try {
      const res = await fetch(`${NHTSA_DECODE_URL}/${encodeURIComponent(vin)}?format=json`);
      if (!res.ok) throw new Error(`NHTSA request failed (${res.status}).`);

      const json = (await res.json()) as { Results?: NhtsaResult[] };
      const r = json.Results?.[0];
      if (!r) throw new Error("NHTSA returned no data for that VIN.");

      const decoded: DecodedVin = {
        year: r.ModelYear && /^\d{4}$/.test(r.ModelYear) ? Number(r.ModelYear) : null,
        make: r.Make?.trim() || null,
        model: r.Model?.trim() || null,
        trim: r.Trim?.trim() || r.Series?.trim() || null,
      };

      if (decoded.year === null && !decoded.make && !decoded.model) {
        throw new Error(r.ErrorText?.trim() || "Could not decode that VIN.");
      }

      setVinDecoded(decoded);

      // Fill in blanks only — never overwrite what the seller already typed.
      if (decoded.year !== null && getValues("year").trim() === "") {
        setValue("year", String(decoded.year), { shouldValidate: true });
      }
      if (decoded.make && getValues("make").trim() === "") {
        setValue("make", decoded.make, { shouldValidate: true });
      }
      if (decoded.model && getValues("model").trim() === "") {
        setValue("model", decoded.model, { shouldValidate: true });
      }
      if (decoded.trim && getValues("trim").trim() === "") {
        setValue("trim", decoded.trim, { shouldValidate: true });
      }
    } catch (err) {
      setVinDecoded(null);
      setVinError(err instanceof Error ? err.message : "VIN decode failed.");
    } finally {
      setVinDecoding(false);
    }
  }

  function applyVinValues() {
    if (!vinDecoded) return;
    if (vinDecoded.year !== null) {
      setValue("year", String(vinDecoded.year), { shouldValidate: true, shouldDirty: true });
    }
    if (vinDecoded.make) {
      setValue("make", vinDecoded.make, { shouldValidate: true, shouldDirty: true });
    }
    if (vinDecoded.model) {
      setValue("model", vinDecoded.model, { shouldValidate: true, shouldDirty: true });
    }
    if (vinDecoded.trim) {
      setValue("trim", vinDecoded.trim, { shouldValidate: true, shouldDirty: true });
    }
  }

  const vinMismatches = useMemo<string[]>(() => {
    if (!vinDecoded) return [];
    const norm = (s: string) => s.trim().toLowerCase();
    const out: string[] = [];
    if (
      vinDecoded.year !== null &&
      enteredYear.trim() !== "" &&
      Number(enteredYear) !== vinDecoded.year
    ) {
      out.push(`Year: you entered ${enteredYear}, the VIN decodes to ${vinDecoded.year}.`);
    }
    if (vinDecoded.make && norm(enteredMake) !== "" && norm(enteredMake) !== norm(vinDecoded.make)) {
      out.push(`Make: you entered "${enteredMake}", the VIN decodes to "${vinDecoded.make}".`);
    }
    if (
      vinDecoded.model &&
      norm(enteredModel) !== "" &&
      norm(enteredModel) !== norm(vinDecoded.model)
    ) {
      out.push(`Model: you entered "${enteredModel}", the VIN decodes to "${vinDecoded.model}".`);
    }
    return out;
  }, [vinDecoded, enteredYear, enteredMake, enteredModel]);

  const vinDecodeStatus: "pending" | "matched" | "mismatch" =
    vinDecoded === null ? "pending" : vinMismatches.length > 0 ? "mismatch" : "matched";

  async function onSubmit(values: FormValues) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);

    const fail = (message: string) => {
      setError("root", { message });
      savingRef.current = false;
      setSaving(false);
    };

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      fail("Your session has expired. Please sign in again.");
      return;
    }

    const { data: created, error } = await supabase
      .from("vehicles")
      .insert({
        seller_id: user.id,
        vin: values.vin.trim().toUpperCase(),
        year: Number(values.year),
        make: values.make.trim(),
        model: values.model.trim(),
        trim: orNull(values.trim),
        mileage: Number(values.mileage),
        exterior_color: orNull(values.exterior_color),
        interior_color: orNull(values.interior_color),
        transmission: orNull(values.transmission),
        fuel_type: orNull(values.fuel_type),
        condition: orNull(values.condition),
        accident_history: orNull(values.accident_history),
        title_status: orNull(values.title_status),
        location_city: values.location_city.trim(),
        location_state: values.location_state.trim().toUpperCase(),
        price_usd: Number(values.price_usd),
        fee_responsibility: values.fee_responsibility,
        description: orNull(values.description),
        status: "draft",
        vin_decode_status: vinDecodeStatus,
      })
      .select("id")
      .single();

    if (error || !created) {
      fail(error?.message ?? "Could not save the listing.");
      return;
    }

    if (values.photos.length > 0) {
      const { error: photoError } = await supabase.from("vehicle_photos").insert(
        values.photos.map((photo, index) => ({
          vehicle_id: created.id,
          url: photo.url,
          sort_order: index,
          is_primary: photo.isPrimary,
        })),
      );

      if (photoError) {
        // Roll the draft back so the seller can retry cleanly rather than end up
        // with a photoless listing they can't edit yet. The "delete own draft"
        // RLS policy allows this.
        await supabase.from("vehicles").delete().eq("id", created.id);
        fail(`Could not attach photos: ${photoError.message}. Please try again.`);
        return;
      }
    }

    // Leave `saving` set: the form stays disabled through the navigation so a
    // late click can't insert a second row.
    router.push("/seller/listings");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/seller/listings"
        className="font-mono text-xs uppercase tracking-wider text-ink-400 hover:text-ink-900"
      >
        &larr; My listings
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-ink-900">New vehicle listing</h1>
      <p className="mt-2 text-sm text-slate-500">
        This saves as a draft. Submit it for review once the details look right.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <SectionLabel>Vehicle identification</SectionLabel>
          <Field
            label="VIN"
            error={errors.vin?.message}
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                {...register("vin")}
                className={cn(inputClass, "flex-1 font-mono uppercase tracking-wide")}
                maxLength={17}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                placeholder="1HGCM82633A004352"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleDecodeVin}
                disabled={vinDecoding}
                className="sm:w-auto"
              >
                {vinDecoding ? "Decoding…" : "Decode VIN"}
              </Button>
            </div>
          </Field>

          {vinError ? <p className="text-sm text-copper-700">{vinError}</p> : null}

          {vinDecoded ? (
            <div className="rounded-lg border border-paper-200 bg-paper-100 p-4">
              <p className="font-mono text-xs uppercase tracking-wider text-ink-400">
                NHTSA VIN decode
              </p>
              <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <VinData
                  label="Year"
                  value={vinDecoded.year !== null ? String(vinDecoded.year) : "—"}
                />
                <VinData label="Make" value={vinDecoded.make ?? "—"} />
                <VinData label="Model" value={vinDecoded.model ?? "—"} />
                <VinData label="Trim" value={vinDecoded.trim ?? "—"} />
              </div>

              {vinMismatches.length > 0 ? (
                <div className="mt-4 rounded border border-copper-100 bg-copper-50 p-3">
                  <p className="text-sm font-medium text-copper-700">
                    These entries do not match the VIN:
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-copper-700">
                    {vinMismatches.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={applyVinValues}
                    className="mt-2 text-sm font-medium text-marine-700 underline underline-offset-2"
                  >
                    Use the decoded year, make and model
                  </button>
                  <p className="mt-2 text-xs text-ink-400">
                    You can still save and submit. The listing will be flagged as a VIN
                    mismatch for admin review.
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-verified-600">
                  Matches the details you entered.
                </p>
              )}
            </div>
          ) : null}
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SectionLabel className="sm:col-span-2">Vehicle details</SectionLabel>
          <Field label="Model year" error={errors.year?.message}>
            <input
              type="number"
              inputMode="numeric"
              min={1900}
              max={MAX_YEAR}
              {...register("year")}
              className={inputClass}
            />
          </Field>
          <Field label="Mileage" error={errors.mileage?.message}>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              {...register("mileage")}
              className={inputClass}
            />
          </Field>
          <Field label="Make" error={errors.make?.message}>
            <input {...register("make")} className={inputClass} autoComplete="off" />
          </Field>
          <Field label="Model" error={errors.model?.message}>
            <input {...register("model")} className={inputClass} autoComplete="off" />
          </Field>
          <Field label="Trim" error={errors.trim?.message} optional>
            <input {...register("trim")} className={inputClass} autoComplete="off" />
          </Field>
          <Field label="Exterior color" error={errors.exterior_color?.message} optional>
            <input {...register("exterior_color")} className={inputClass} autoComplete="off" />
          </Field>
          <Field label="Interior color" error={errors.interior_color?.message} optional>
            <input {...register("interior_color")} className={inputClass} autoComplete="off" />
          </Field>
          <Field label="Transmission" error={errors.transmission?.message} optional>
            <select {...register("transmission")} className={inputClass}>
              <option value="">Select…</option>
              {TRANSMISSIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fuel type" error={errors.fuel_type?.message} optional>
            <select {...register("fuel_type")} className={inputClass}>
              <option value="">Select…</option>
              {FUEL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SectionLabel className="sm:col-span-2">Condition and title</SectionLabel>
          <Field label="Condition" error={errors.condition?.message} optional>
            <select {...register("condition")} className={inputClass}>
              <option value="">Select…</option>
              {CONDITIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Accident history" error={errors.accident_history?.message} optional>
            <select {...register("accident_history")} className={inputClass}>
              <option value="">Select…</option>
              {ACCIDENT_HISTORY.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title status" error={errors.title_status?.message} optional>
            <select {...register("title_status")} className={inputClass}>
              <option value="">Select…</option>
              {TITLE_STATUSES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SectionLabel className="sm:col-span-2">Location and price</SectionLabel>
          <Field label="City" error={errors.location_city?.message}>
            <input {...register("location_city")} className={inputClass} autoComplete="off" />
          </Field>
          <Field label="State" error={errors.location_state?.message}>
            <select {...register("location_state")} className={inputClass}>
              <option value="">Select…</option>
              {US_STATES.map(([code, name]) => (
                <option key={code} value={code}>
                  {code} — {name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Asking price (USD)"
            error={errors.price_usd?.message}
            className="sm:col-span-2"
          >
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              {...register("price_usd")}
              className={inputClass}
            />
          </Field>

          <fieldset className="flex flex-col gap-2 sm:col-span-2">
            <legend className="text-sm text-slate-500">
              Who covers MOVA&rsquo;s 8% service fee?
            </legend>
            <label className="flex items-start gap-2 rounded border border-paper-200 bg-paper-100 p-3">
              <input
                type="radio"
                value="buyer_pays_full"
                {...register("fee_responsibility")}
                className="mt-1"
              />
              <span className="text-sm text-ink-900">Buyer pays full fee</span>
            </label>
            <label className="flex items-start gap-2 rounded border border-paper-200 bg-paper-100 p-3">
              <input
                type="radio"
                value="split"
                {...register("fee_responsibility")}
                className="mt-1"
              />
              <span className="text-sm text-ink-900">Split 50/50 with buyer</span>
            </label>
            <p className="text-xs text-ink-400">
              This doesn&rsquo;t change what you receive for the vehicle — MOVA&rsquo;s
              fee is charged on top of your asking price either way.
            </p>
            {errors.fee_responsibility?.message ? (
              <span className="text-sm text-copper-700">
                {errors.fee_responsibility.message}
              </span>
            ) : null}
          </fieldset>
        </section>

        <section className="flex flex-col gap-3">
          <SectionLabel>Description</SectionLabel>
          <Field label="Description" error={errors.description?.message} optional>
            <textarea
              {...register("description")}
              rows={5}
              className="rounded border border-paper-200 bg-paper-100 px-3 py-2 text-ink-900"
              placeholder="Service history, notable features, anything a buyer should know."
            />
          </Field>
        </section>

        <section className="flex flex-col gap-3">
          <SectionLabel>Photos</SectionLabel>
          <p className="text-sm text-slate-500">
            Add up to {MAX_PHOTOS} photos. The primary photo leads the listing in
            search results; drag a thumbnail or use the arrows to reorder the rest.
          </p>
          <PhotoUploader
            value={photos}
            onChange={(next: PhotoDraft[]) =>
              setValue("photos", next, { shouldValidate: true, shouldDirty: true })
            }
            disabled={isSubmitting || saving}
            maxPhotos={MAX_PHOTOS}
            error={errors.photos?.message}
          />
        </section>

        {errors.root?.message ? (
          <p className="text-sm text-copper-700">{errors.root.message}</p>
        ) : null}

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={isSubmitting || saving}>
            {isSubmitting || saving ? "Saving…" : "Save draft"}
          </Button>
          <Link href="/seller/listings" className="text-sm text-slate-500 hover:text-ink-900">
            Cancel
          </Link>
          <span className="ml-auto font-mono text-xs uppercase tracking-wider text-ink-400">
            VIN check: {vinDecodeStatus}
          </span>
        </div>
      </form>
    </main>
  );
}
