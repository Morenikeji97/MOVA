import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApplyForm } from "./apply-form";
import { cardClasses } from "@/components/ui/card";
import { displayPlace } from "@/lib/place";
import {
  DashboardHeader,
  DashboardShell,
  EmptyCard,
  Notice,
  StatusPill,
  type PillTone,
} from "@/components/ui/dashboard";

export const metadata: Metadata = { title: "Inspector — ShipMova", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, PillTone> = {
  assigned: "warning",
  submitted: "info",
  passed: "success",
  failed: "warning",
};

const STATUS_LABEL: Record<string, string> = {
  assigned: "To do",
  submitted: "Sent — ShipMova is reviewing",
  passed: "Passed",
  failed: "Failed",
};

/** An inspector's home: apply, or see assigned inspections (0063). */
export default async function InspectorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/inspector");

  const { data: me } = await supabase
    .from("inspectors")
    .select("id, status, full_name, rejection_reason")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!me) {
    return (
      <DashboardShell narrow>
        <DashboardHeader
          eyebrow="Inspectors"
          title="Inspect cars for ShipMova"
          intro="Inspectors check a car in person at pickup: the VIN plate, the odometer and the title, with photos. You're paid 2% of the car's price for each completed inspection."
        />
        <div className={cardClasses({ className: "mt-6" })}>
          <ApplyForm />
        </div>
      </DashboardShell>
    );
  }
  if (me.status !== "approved") {
    return (
      <DashboardShell narrow>
        <DashboardHeader eyebrow="Inspectors" title="Your application" />
        <Notice tone={me.status === "pending" ? "info" : "warning"} className="mt-4">
          {me.status === "pending"
            ? "ShipMova is reviewing your application."
            : me.status === "suspended"
              ? "Your inspector account is paused. Contact ShipMova."
              : `Your application wasn't approved${me.rejection_reason ? `: ${me.rejection_reason}` : ""}.`}
        </Notice>
      </DashboardShell>
    );
  }

  // Approved: assigned inspections (service role read, limited to this inspector).
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("inspections")
    .select("id, status, assigned_at, purchase_request_id")
    .eq("inspector_id", me.id)
    .neq("status", "cancelled")
    .order("assigned_at", { ascending: false })
    .limit(30);
  const prIds = (rows ?? []).map((r) => r.purchase_request_id);
  const { data: prs } = prIds.length
    ? await admin.from("purchase_requests").select("id, reference, vehicle_id").in("id", prIds)
    : { data: [] };
  const vehicleIds = (prs ?? []).map((p) => p.vehicle_id);
  const { data: cars } = vehicleIds.length
    ? await admin.from("vehicles").select("id, year, make, model, location_city, location_state").in("id", vehicleIds)
    : { data: [] };

  return (
    <DashboardShell narrow>
      <DashboardHeader eyebrow="Inspector" title="Your inspections" intro={`Signed in as ${user.email}`} />
      {!rows || rows.length === 0 ? (
        <div className="mt-6">
          <EmptyCard title="No inspections yet">
            ShipMova picks inspectors at random for each car. New jobs appear here.
          </EmptyCard>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {rows.map((r) => {
            const pr = prs?.find((p) => p.id === r.purchase_request_id);
            const car = cars?.find((c) => c.id === pr?.vehicle_id);
            return (
              <li key={r.id}>
                <Link href={`/inspector/${r.id}`} className={cardClasses({ className: "block transition-colors hover:border-ink" })}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StatusPill tone={STATUS_TONE[r.status] ?? "neutral"}>{STATUS_LABEL[r.status] ?? r.status}</StatusPill>
                    <span className="font-mono text-xs text-muted">{pr?.reference ?? ""}</span>
                  </div>
                  <p className="mt-2 font-display text-lg font-bold text-ink">
                    {car ? `${car.year} ${car.make} ${car.model}` : "Car"}
                  </p>
                  <p className="text-sm text-muted">
                    {car ? displayPlace(car.location_city, car.location_state) : ""}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardShell>
  );
}
