import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { feeBreakdown } from "@/lib/fees";
import type { FeeResponsibility } from "@/types/database";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const usdCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const RESERVATION_STATUS_COPY: Record<string, string> = {
  submitted: "Submitted — waiting for MOVA to review.",
  under_review: "MOVA is reviewing your request.",
  verified: "Verified — MOVA will be in touch with next steps.",
  completed: "Completed.",
  rejected: "Not accepted.",
  cancelled: "Released.",
};

const OPEN_STATUSES = ["submitted", "under_review", "verified"];

function Contact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="font-mono text-xs uppercase tracking-wider text-ink-400">
        {label}
      </dt>
      <dd className="text-ink-900">{value}</dd>
    </div>
  );
}

export default async function BuyerDashboard({
  searchParams,
}: {
  searchParams: Promise<{ fee?: string }>;
}) {
  const { fee } = await searchParams;
  const feeNotice =
    fee === "paid" ? "paid" : fee === "cancelled" ? "cancelled" : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profileData }, { data: reservationRows }] = await Promise.all([
    supabase
      .from("buyer_profiles")
      .select("*")
      .eq("user_id", user!.id)
      .single(),
    supabase
      .from("purchase_requests")
      .select(
        "id, vehicle_id, status, created_at, vehicle_price_usd, mova_fee_usd, mova_fee_payment_status, mova_fee_checkout_url, seller_name, seller_email, seller_phone, seller_whatsapp",
      )
      .eq("buyer_id", user!.id)
      .order("created_at", { ascending: false }),
  ]);

  const profile = profileData;
  const reservations = reservationRows ?? [];

  const vehicleIds = [...new Set(reservations.map((r) => r.vehicle_id))];
  const { data: vehicleRows } = vehicleIds.length
    ? await supabase
        .from("vehicles")
        .select("id, year, make, model, trim, price_usd, fee_responsibility")
        .in("id", vehicleIds)
    : { data: [] };
  const vehicleById = new Map((vehicleRows ?? []).map((v) => [v.id, v]));

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-ink-900">Buyer Dashboard</h1>
      <p className="mt-2 text-slate-500">Signed in as {user?.email}</p>
      <p className="mt-1 font-mono text-sm text-ink-400">
        NIN verification: {profile?.nin_verification_status ?? "unverified"}
      </p>

      {feeNotice === "paid" ? (
        <p className="mt-6 rounded border border-verified-100 bg-verified-50 p-3 text-sm text-verified-600">
          Thanks — your MOVA service fee is being confirmed. The seller&rsquo;s
          contact and payment details appear below as soon as Stripe confirms,
          usually within a minute.
        </p>
      ) : null}
      {feeNotice === "cancelled" ? (
        <p className="mt-6 rounded border border-copper-100 bg-copper-50 p-3 text-sm text-copper-700">
          Payment was cancelled. You can reopen the payment link below whenever
          you&rsquo;re ready.
        </p>
      ) : null}

      <section className="mt-10">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-ink-900">Your reservations</h2>
          <Link
            href="/browse"
            className="text-sm text-marine-700 hover:underline"
          >
            Browse vehicles &rarr;
          </Link>
        </div>

        {reservations.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-paper-200 bg-paper-100 p-8 text-center">
            <p className="text-ink-900">You haven&rsquo;t reserved any vehicles yet.</p>
            <p className="mt-1 text-sm text-slate-500">
              Reserve a vehicle from its listing to send MOVA a request.
            </p>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {reservations.map((r) => {
              const vehicle = vehicleById.get(r.vehicle_id);
              const title = vehicle
                ? `${vehicle.year} ${vehicle.make} ${vehicle.model}${
                    vehicle.trim ? ` ${vehicle.trim}` : ""
                  }`
                : "Vehicle no longer listed";

              const feePaid = r.mova_fee_payment_status === "paid";

              // The buyer's fee portion: prefer the live listing's split choice;
              // fall back to the full snapshotted fee if the listing is gone.
              const fullFee = r.mova_fee_usd != null ? Number(r.mova_fee_usd) : null;
              const feeResponsibility =
                (vehicle?.fee_responsibility as FeeResponsibility | undefined) ??
                "buyer_pays_full";
              const snapshotPrice =
                r.vehicle_price_usd != null ? Number(r.vehicle_price_usd) : null;
              const buyerFee =
                snapshotPrice != null
                  ? feeBreakdown(snapshotPrice, feeResponsibility).buyerFee
                  : fullFee != null
                    ? feeResponsibility === "split"
                      ? fullFee / 2
                      : fullFee
                    : null;

              const showPayLink =
                !feePaid &&
                OPEN_STATUSES.includes(r.status) &&
                Boolean(r.mova_fee_checkout_url);
              const showFeePending =
                !feePaid &&
                OPEN_STATUSES.includes(r.status) &&
                !r.mova_fee_checkout_url;

              return (
                <li
                  key={r.id}
                  className="rounded-lg border border-paper-200 bg-paper-100 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-ink-900">
                        {vehicle ? (
                          <Link
                            href={`/browse/${r.vehicle_id}`}
                            className="hover:underline"
                          >
                            {title}
                          </Link>
                        ) : (
                          title
                        )}
                      </h3>
                      {snapshotPrice != null || vehicle ? (
                        <p className="mt-1 font-mono text-sm text-ink-400">
                          {usd.format(
                            snapshotPrice ?? Number(vehicle!.price_usd),
                          )}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {RESERVATION_STATUS_COPY[r.status] ?? r.status}
                  </p>

                  {showFeePending ? (
                    <p className="mt-3 rounded border border-paper-200 bg-paper p-3 text-sm text-slate-500">
                      MOVA will send your service-fee payment link here once your
                      reservation has been reviewed.
                    </p>
                  ) : null}

                  {showPayLink ? (
                    <div className="mt-3 rounded border border-marine-100 bg-marine-50 p-4">
                      <p className="text-sm font-medium text-marine-700">
                        Pay MOVA&rsquo;s service fee
                        {buyerFee != null ? ` — ${usdCents.format(buyerFee)}` : ""}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Paying this unlocks the seller&rsquo;s contact and payment
                        details. You then wire the vehicle price to the seller
                        directly.
                      </p>
                      <a
                        href={r.mova_fee_checkout_url!}
                        className="mt-3 inline-flex h-9 items-center justify-center rounded bg-copper px-3 text-sm font-medium text-white transition-colors hover:bg-copper-700"
                      >
                        Pay with Stripe
                      </a>
                    </div>
                  ) : null}

                  {feePaid ? (
                    <div className="mt-3 rounded border border-verified-100 bg-verified-50 p-4">
                      <p className="text-sm font-semibold text-ink-900">
                        Seller contact &amp; payment details
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        MOVA&rsquo;s service fee is paid. Wire the vehicle price
                        below to the seller directly — the fee is not part of that
                        amount.
                      </p>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                        <Contact label="Seller" value={r.seller_name} />
                        <Contact label="Email" value={r.seller_email} />
                        <Contact label="Phone" value={r.seller_phone} />
                        <Contact label="WhatsApp" value={r.seller_whatsapp} />
                        <div>
                          <dt className="font-mono text-xs uppercase tracking-wider text-ink-400">
                            Wire to seller
                          </dt>
                          <dd className="font-semibold text-ink-900">
                            {snapshotPrice != null
                              ? usdCents.format(snapshotPrice)
                              : "—"}
                          </dd>
                        </div>
                      </dl>
                      {!r.seller_name &&
                      !r.seller_email &&
                      !r.seller_phone &&
                      !r.seller_whatsapp ? (
                        <p className="mt-2 text-sm text-copper-700">
                          The seller hasn&rsquo;t added contact details yet — MOVA
                          will follow up with you directly.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
