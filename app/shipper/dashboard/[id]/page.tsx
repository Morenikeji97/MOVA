import { type ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { countryName } from "@/lib/shipping";
import { ShippingStatusControl } from "../status-control";
import { ShipmentProofUploader } from "@/components/ui/shipment-proof-uploader";
import { NoteForm } from "./note-form";

const PROOF_BUCKET = "shipment-proof-photos";

const fmtDateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(amount);

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/shipper/dashboard"
        className="font-mono text-xs uppercase tracking-wider text-ink-400 hover:text-ink-900"
      >
        &larr; Your shipments
      </Link>
      {children}
    </main>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-xs uppercase tracking-wider text-ink-400">
        {label}
      </dt>
      <dd className="text-ink-900">{children}</dd>
    </div>
  );
}

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/shipper/dashboard/${id}`);

  const { data: shipper } = await supabase
    .from("shippers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!shipper) redirect("/shipper");

  const { data: shipment } = await supabase
    .from("shipment_requests")
    .select(
      "id, shipper_id, shipping_rate_id, agreed_rate, currency, shipping_status, vehicle_year, vehicle_make, vehicle_model, vehicle_trim, pickup_city, pickup_state, buyer_name, buyer_email, buyer_phone, buyer_whatsapp, buyer_details_revealed_at, created_at",
    )
    .eq("id", id)
    .eq("shipper_id", shipper.id)
    .maybeSingle();
  if (!shipment) notFound();

  const [{ data: rate }, { data: photoRows }, { data: updateRows }] = await Promise.all([
    shipment.shipping_rate_id
      ? supabase
          .from("shipping_rates")
          .select("origin_region, destination_country")
          .eq("id", shipment.shipping_rate_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("shipment_proof_photos")
      .select("id, kind, storage_path, created_at")
      .eq("shipment_request_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("shipment_updates")
      .select("id, author_id, note, created_at")
      .eq("shipment_request_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const photos = photoRows ?? [];
  const signedByPath = new Map(
    await Promise.all(
      photos.map(async (p) => {
        const { data } = await supabase.storage
          .from(PROOF_BUCKET)
          .createSignedUrl(p.storage_path, 300);
        return [p.storage_path, data?.signedUrl ?? null] as const;
      }),
    ),
  );

  const pickupPhotos = photos.filter((p) => p.kind === "pickup");
  const deliveryPhotos = photos.filter((p) => p.kind === "delivery");
  const vehicleLabel = [shipment.vehicle_year, shipment.vehicle_make, shipment.vehicle_model]
    .filter(Boolean)
    .join(" ");

  return (
    <Shell>
      <h1 className="mt-4 text-2xl font-semibold text-ink-900">
        {vehicleLabel || "Vehicle details unavailable"}
        {shipment.vehicle_trim ? (
          <span className="font-normal text-ink-400"> {shipment.vehicle_trim}</span>
        ) : null}
      </h1>

      <div className="mt-4">
        <ShippingStatusControl shipmentId={shipment.id} current={shipment.shipping_status} />
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-paper-200 bg-paper-100 p-5 text-sm">
        <Detail label="Pickup location">
          {[shipment.pickup_city, shipment.pickup_state].filter(Boolean).join(", ") || "—"}
        </Detail>
        <Detail label="Destination">{countryName(rate?.destination_country)}</Detail>
        <Detail label="Agreed rate">
          {money(Number(shipment.agreed_rate), shipment.currency)}
        </Detail>
        <Detail label="Requested">{fmtDateTime.format(new Date(shipment.created_at))}</Detail>
      </dl>

      {/* Buyer contact — always revealed once the shipment exists (see 0016). */}
      <section className="mt-6 rounded-lg border border-verified-100 bg-verified-50 p-5">
        <h2 className="font-mono text-xs uppercase tracking-wider text-ink-400">
          Buyer contact
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          {shipment.buyer_name ? <Detail label="Name">{shipment.buyer_name}</Detail> : null}
          {shipment.buyer_email ? <Detail label="Email">{shipment.buyer_email}</Detail> : null}
          {shipment.buyer_phone ? <Detail label="Phone">{shipment.buyer_phone}</Detail> : null}
          {shipment.buyer_whatsapp ? (
            <Detail label="WhatsApp">{shipment.buyer_whatsapp}</Detail>
          ) : null}
        </dl>
      </section>

      {/* Proof of pickup / delivery */}
      <section className="mt-10">
        <h2 className="font-mono text-xs uppercase tracking-wider text-ink-400">
          Proof of pickup
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          {pickupPhotos.length > 0 ? (
            <ul className="grid grid-cols-3 gap-2">
              {pickupPhotos.map((p) => {
                const url = signedByPath.get(p.storage_path);
                return url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={p.id}
                    src={url}
                    alt="Proof of pickup"
                    className="aspect-square w-full rounded border border-paper-200 object-cover"
                  />
                ) : null;
              })}
            </ul>
          ) : null}
          <ShipmentProofUploader shipmentId={shipment.id} kind="pickup" label="Add pickup photo" />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-mono text-xs uppercase tracking-wider text-ink-400">
          Proof of delivery
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          {deliveryPhotos.length > 0 ? (
            <ul className="grid grid-cols-3 gap-2">
              {deliveryPhotos.map((p) => {
                const url = signedByPath.get(p.storage_path);
                return url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={p.id}
                    src={url}
                    alt="Proof of delivery"
                    className="aspect-square w-full rounded border border-paper-200 object-cover"
                  />
                ) : null;
              })}
            </ul>
          ) : null}
          <ShipmentProofUploader
            shipmentId={shipment.id}
            kind="delivery"
            label="Add delivery photo"
          />
        </div>
      </section>

      {/* Buyer-visible notes */}
      <section className="mt-10">
        <h2 className="font-mono text-xs uppercase tracking-wider text-ink-400">
          Updates ({(updateRows ?? []).length})
        </h2>
        <div className="mt-3">
          <NoteForm shipmentId={shipment.id} />
        </div>
        {(updateRows ?? []).length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {(updateRows ?? []).map((u) => (
              <li
                key={u.id}
                className="rounded border border-paper-200 bg-paper-100 p-3 text-sm"
              >
                <p className="text-ink-900">{u.note}</p>
                <p className="mt-1 font-mono text-xs text-ink-400">
                  {fmtDateTime.format(new Date(u.created_at))}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </Shell>
  );
}

export const dynamic = "force-dynamic";
