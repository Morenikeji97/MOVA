import { type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DISPUTE_CATEGORY_LABEL, DISPUTE_EVIDENCE_BUCKET } from "@/lib/disputes";
import type { DisputeStatus } from "@/types/database";
import { DisputeActions } from "./dispute-actions";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const submitted = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

// The active queue: open (needs a decision) and approved-pending-refund
// (needs "mark refund completed" once processed manually). Denied and
// refund_completed are terminal and drop off, same convention as the
// reservations/listings admin queues.
const ACTIVE_STATUSES: DisputeStatus[] = ["open", "approved_pending_refund"];

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-xs uppercase tracking-wider text-ink-400">{label}</dt>
      <dd className="text-ink-900">{children}</dd>
    </div>
  );
}

export default async function AdminDisputesPage() {
  const supabase = await createClient();

  const { data: disputeRows } = await supabase
    .from("disputes")
    .select(
      "id, purchase_request_id, reporter_id, category, description, evidence_paths, status, created_at",
    )
    .in("status", ACTIVE_STATUSES)
    .order("created_at", { ascending: true });

  const disputes = disputeRows ?? [];

  const reservationIds = [...new Set(disputes.map((d) => d.purchase_request_id))];
  const reporterIds = [...new Set(disputes.map((d) => d.reporter_id))];

  const { data: reservationRows } = reservationIds.length
    ? await supabase
        .from("purchase_requests")
        .select(
          "id, vehicle_id, buyer_id, status, vehicle_price_usd, mova_fee_usd, mova_fee_payment_status",
        )
        .in("id", reservationIds)
    : { data: [] };
  const reservationById = new Map((reservationRows ?? []).map((r) => [r.id, r]));

  const vehicleIds = [...new Set((reservationRows ?? []).map((r) => r.vehicle_id))];
  const { data: vehicleRows } = vehicleIds.length
    ? await supabase
        .from("vehicles")
        .select("id, year, make, model, trim, price_usd, seller_id, vehicle_vin_display")
        .in("id", vehicleIds)
    : { data: [] };
  const vehicleById = new Map((vehicleRows ?? []).map((v) => [v.id, v]));

  const buyerIds = [...new Set((reservationRows ?? []).map((r) => r.buyer_id))];
  const sellerIds = [...new Set((vehicleRows ?? []).map((v) => v.seller_id))];
  const userIds = [...new Set([...buyerIds, ...sellerIds, ...reporterIds])];
  const { data: userRows } = userIds.length
    ? await supabase.from("users").select("id, email").in("id", userIds)
    : { data: [] };
  const emailById = new Map((userRows ?? []).map((u) => [u.id, u.email]));

  // Signed URLs for evidence — dispute-evidence is a private bucket, so
  // admin viewing goes through a short-lived signed URL, same technique as
  // the bank-transfer proof viewer in /admin/reservations.
  const evidenceEntries = await Promise.all(
    disputes.flatMap((d) =>
      d.evidence_paths.map(async (path) => {
        const { data } = await supabase.storage
          .from(DISPUTE_EVIDENCE_BUCKET)
          .createSignedUrl(path, 300);
        return [path, data?.signedUrl ?? null] as const;
      }),
    ),
  );
  const signedUrlByPath = new Map(evidenceEntries);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link
        href="/admin/dashboard"
        className="font-mono text-xs uppercase tracking-wider text-ink-400 hover:text-ink-900"
      >
        &larr; Admin dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-ink-900">Disputes</h1>
      <p className="mt-2 text-sm text-slate-500">
        {disputes.length === 0
          ? "No open disputes."
          : `${disputes.length} dispute${disputes.length === 1 ? "" : "s"} needing attention.`}
      </p>

      {disputes.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-paper-200 bg-paper-100 p-10 text-center">
          <p className="text-ink-900">Nothing to review.</p>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {disputes.map((d) => {
            const reservation = reservationById.get(d.purchase_request_id);
            const vehicle = reservation ? vehicleById.get(reservation.vehicle_id) : undefined;
            const title = vehicle
              ? `${vehicle.year} ${vehicle.make} ${vehicle.model}${
                  vehicle.trim ? ` ${vehicle.trim}` : ""
                }`
              : "Vehicle unavailable";
            const price =
              reservation?.vehicle_price_usd != null
                ? Number(reservation.vehicle_price_usd)
                : vehicle
                  ? Number(vehicle.price_usd)
                  : null;

            return (
              <li
                key={d.id}
                className="rounded-lg border border-paper-200 bg-paper-100 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-ink-900">
                      {DISPUTE_CATEGORY_LABEL[d.category]}
                    </h2>
                    {reservation ? (
                      <Link
                        href={`/browse/${reservation.vehicle_id}`}
                        className="mt-1 block text-sm text-marine-700 hover:underline"
                      >
                        {title}
                        {vehicle ? ` — VIN ${vehicle.vehicle_vin_display}` : ""}
                      </Link>
                    ) : (
                      <p className="mt-1 text-sm text-ink-400">Reservation unavailable</p>
                    )}
                  </div>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-marine-50 px-2.5 py-1 text-sm font-medium text-marine-700">
                    {d.status === "open" ? "Open" : "Approved — awaiting refund"}
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                  <Detail label="Filed by">
                    {emailById.get(d.reporter_id) ?? "—"}
                    {reservation?.buyer_id === d.reporter_id
                      ? " (buyer)"
                      : vehicle?.seller_id === d.reporter_id
                        ? " (seller)"
                        : ""}
                  </Detail>
                  <Detail label="Filed">{submitted.format(new Date(d.created_at))}</Detail>
                  {price != null ? (
                    <Detail label="Vehicle price">{usd.format(price)}</Detail>
                  ) : null}
                  {reservation ? (
                    <Detail label="Buyer">{emailById.get(reservation.buyer_id) ?? "—"}</Detail>
                  ) : null}
                  {vehicle ? (
                    <Detail label="Seller">{emailById.get(vehicle.seller_id) ?? "—"}</Detail>
                  ) : null}
                  {reservation ? (
                    <Detail label="Reservation status">{reservation.status}</Detail>
                  ) : null}
                  {reservation ? (
                    <Detail label="MOVA fee">{reservation.mova_fee_payment_status}</Detail>
                  ) : null}
                </dl>

                <div className="mt-3">
                  <p className="font-mono text-xs uppercase tracking-wider text-ink-400">
                    Description
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink-900">
                    {d.description}
                  </p>
                </div>

                {d.evidence_paths.length > 0 ? (
                  <div className="mt-3">
                    <p className="font-mono text-xs uppercase tracking-wider text-ink-400">
                      Evidence ({d.evidence_paths.length})
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {d.evidence_paths.map((path) => {
                        const url = signedUrlByPath.get(path);
                        const isPdf = path.toLowerCase().endsWith(".pdf");
                        if (!url) {
                          return (
                            <span key={path} className="text-sm text-copper-700">
                              Couldn&rsquo;t load file.
                            </span>
                          );
                        }
                        if (isPdf) {
                          return (
                            <a
                              key={path}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-marine-700 underline underline-offset-2"
                            >
                              View PDF &rarr;
                            </a>
                          );
                        }
                        return (
                          <a key={path} href={url} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt="Dispute evidence"
                              className="h-24 w-24 rounded border border-paper-200 object-cover"
                            />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <DisputeActions
                  disputeId={d.id}
                  status={d.status as "open" | "approved_pending_refund"}
                />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
