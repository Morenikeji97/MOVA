import { type ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { countryName } from "@/lib/shipping";
import type { ShipmentShippingStatus } from "@/types/database";
import { ShippingStatusControl } from "./status-control";

const URGENCY: Record<ShipmentShippingStatus, number> = {
  awaiting_pickup: 0,
  picked_up: 1,
  in_transit: 2,
  delivered: 3,
};

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link
        href="/shipper"
        className="font-mono text-xs uppercase tracking-wider text-ink-400 hover:text-ink-900"
      >
        &larr; Shipper portal
      </Link>
      {children}
    </main>
  );
}

export default async function ShipperDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/shipper/dashboard");

  const { data: shipper } = await supabase
    .from("shippers")
    .select("id, company_name, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!shipper || shipper.status !== "approved") {
    redirect("/shipper");
  }

  const [{ data: shipmentRows }, { data: rateRows }] = await Promise.all([
    supabase
      .from("shipment_requests")
      .select(
        "id, vehicle_year, vehicle_make, vehicle_model, vehicle_trim, pickup_city, pickup_state, shipping_status, shipping_rate_id, created_at",
      )
      .eq("shipper_id", shipper.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("shipping_rates")
      .select("id, destination_country")
      .eq("shipper_id", shipper.id),
  ]);

  const destinationByRate = new Map(
    (rateRows ?? []).map((r) => [r.id, r.destination_country]),
  );

  const shipments = (shipmentRows ?? []).slice().sort((a, b) => {
    const u = URGENCY[a.shipping_status] - URGENCY[b.shipping_status];
    if (u !== 0) return u;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <Shell>
      <h1 className="mt-4 text-2xl font-semibold text-ink-900">
        {shipper.company_name}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Your assigned shipments, most urgent first.
      </p>

      {shipments.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-paper-200 bg-paper-100 p-10 text-center">
          <p className="text-ink-900">No shipments yet.</p>
          <p className="mt-1 text-sm text-slate-500">
            When a buyer selects one of your rates, it shows up here.
          </p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {shipments.map((s) => {
            const vehicleLabel = [s.vehicle_year, s.vehicle_make, s.vehicle_model]
              .filter(Boolean)
              .join(" ");
            const destination = s.shipping_rate_id
              ? destinationByRate.get(s.shipping_rate_id)
              : null;

            return (
              <li
                key={s.id}
                className="rounded-lg border border-paper-200 bg-paper-100 p-5"
              >
                <Link
                  href={`/shipper/dashboard/${s.id}`}
                  className="block"
                >
                  <h2 className="text-lg font-semibold text-ink-900">
                    {vehicleLabel || "Vehicle details unavailable"}
                    {s.vehicle_trim ? (
                      <span className="font-normal text-ink-400"> {s.vehicle_trim}</span>
                    ) : null}
                  </h2>
                  <p className="mt-1 font-mono text-sm text-ink-400">
                    {[s.pickup_city, s.pickup_state].filter(Boolean).join(", ") || "Pickup location unavailable"}
                    {" → "}
                    {countryName(destination)}
                  </p>
                </Link>

                <div className="mt-4 border-t border-paper-200 pt-4">
                  <ShippingStatusControl
                    shipmentId={s.id}
                    current={s.shipping_status}
                  />
                </div>

                <Link
                  href={`/shipper/dashboard/${s.id}`}
                  className="mt-3 inline-block text-sm text-marine-700 hover:underline"
                >
                  View details, contact &amp; photos &rarr;
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Shell>
  );
}

export const dynamic = "force-dynamic";
