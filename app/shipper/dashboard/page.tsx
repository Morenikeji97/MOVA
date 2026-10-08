import { type ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  BackLink,
  DashboardHeader,
  DashboardShell,
  EmptyCard,
  StatusPill,
  type PillTone,
} from "@/components/ui/dashboard";
import { cardClasses } from "@/components/ui/card";
import { countryName } from "@/lib/shipping";
import type { ShipmentShippingStatus } from "@/types/database";
import { ShippingStatusControl } from "./status-control";

const URGENCY: Record<ShipmentShippingStatus, number> = {
  awaiting_pickup: 0,
  picked_up: 1,
  in_transit: 2,
  delivered: 3,
};

const STATUS_LABEL: Record<ShipmentShippingStatus, string> = {
  awaiting_pickup: "Awaiting pickup",
  picked_up: "Picked up",
  in_transit: "In transit",
  delivered: "Delivered",
};

const STATUS_TONE: Record<ShipmentShippingStatus, PillTone> = {
  awaiting_pickup: "warning",
  picked_up: "info",
  in_transit: "info",
  delivered: "success",
};

function Shell({ children }: { children: ReactNode }) {
  return (
    <DashboardShell narrow>
      <BackLink href="/shipper/portal">Shipper portal</BackLink>
      {children}
    </DashboardShell>
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
    redirect("/shipper/portal");
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
      <DashboardHeader
        className="mt-2"
        eyebrow={shipper.company_name}
        title="Your shipments"
        intro="Most urgent first. Tap a status to update it."
      />

      {shipments.length === 0 ? (
        <div className="mt-6">
          <EmptyCard title="No shipments yet">
            When a buyer selects one of your rates, it shows up here.
          </EmptyCard>
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
              <li key={s.id} className={cardClasses()}>
                <StatusPill tone={STATUS_TONE[s.shipping_status]}>{STATUS_LABEL[s.shipping_status]}</StatusPill>
                <Link
                  href={`/shipper/dashboard/${s.id}`}
                  className="mt-2 block"
                >
                  <h2 className="break-words font-display text-xl font-bold leading-snug text-ink">
                    {vehicleLabel || "Vehicle details unavailable"}
                    {s.vehicle_trim ? (
                      <span className="font-normal text-muted"> {s.vehicle_trim}</span>
                    ) : null}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {[s.pickup_city, s.pickup_state].filter(Boolean).join(", ") || "Pickup location unavailable"}
                    {" → "}
                    {countryName(destination)}
                  </p>
                </Link>

                <div className="mt-4 border-t border-line pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Update status</p>
                  <ShippingStatusControl
                    shipmentId={s.id}
                    current={s.shipping_status}
                  />
                </div>

                <Link
                  href={`/shipper/dashboard/${s.id}`}
                  className="mt-3 flex h-11 items-center text-sm font-semibold text-ink underline underline-offset-2"
                >
                  Details, buyer contact &amp; photos &rarr;
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
