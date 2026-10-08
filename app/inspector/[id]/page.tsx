import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { REQUIRED_PHOTO_KINDS } from "@/lib/inspection-checks";
import { PhotoCapture } from "./photo-capture";
import { ReportForm } from "./report-form";
import { cardClasses } from "@/components/ui/card";
import { displayPlace } from "@/lib/place";
import { BackLink, DashboardShell, Notice, StatusPill } from "@/components/ui/dashboard";

export const metadata: Metadata = { title: "Inspection — ShipMova", robots: { index: false } };
export const dynamic = "force-dynamic";

const KIND_LABEL = { vin: "VIN plate", odometer: "Odometer", title: "Title (front)", car: "The car" } as const;

/** One inspection, for its assigned inspector. The VIN isn't shown: the inspector reads it from the car. */
export default async function InspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/inspector/${id}`);

  // RLS: only the assigned inspector (or an admin) can read it.
  const { data: x } = await supabase
    .from("inspections")
    .select("id, status, purchase_request_id, assigned_at")
    .eq("id", id)
    .maybeSingle();
  if (!x) notFound();
  const { data: photos } = await supabase.from("inspection_photos").select("kind").eq("inspection_id", x.id);
  const have = new Set((photos ?? []).map((p) => p.kind));

  const admin = createAdminClient();
  const { data: pr } = await admin.from("purchase_requests").select("reference, vehicle_id").eq("id", x.purchase_request_id).maybeSingle();
  const { data: car } = pr
    ? await admin.from("vehicles").select("year, make, model, trim, location_city, location_state").eq("id", pr.vehicle_id).maybeSingle()
    : { data: null };
  const ready = REQUIRED_PHOTO_KINDS.every((k) => have.has(k));

  return (
    <DashboardShell narrow>
      <BackLink href="/inspector">Your inspections</BackLink>
      <p className="mt-2 font-mono text-xs text-muted">{pr?.reference}</p>
      <h1 className="break-words font-display text-3xl font-extrabold tracking-tight text-ink">
        {car ? `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}` : "Car"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {car ? displayPlace(car.location_city, car.location_state) : ""}. ShipMova sends you the pickup time and address.
      </p>

      {x.status !== "assigned" ? (
        <Notice tone="info" className="mt-6">
          {x.status === "submitted" ? "Report sent — ShipMova is reviewing it." : `This inspection is ${x.status}.`}
        </Notice>
      ) : (
        <>
          <section className={cardClasses({ className: "mt-6" })}>
            <h2 className="font-display text-lg font-bold text-ink">1. Photos at the car</h2>
            <p className="mt-1 text-sm text-muted">Each photo records where and when it was taken. Allow location when asked.</p>
            <ul className="mt-3 flex flex-col gap-3">
              {(["vin", "odometer", "title", "car"] as const).map((k) => (
                <li key={k} className="flex flex-col gap-2 rounded-lg border border-line bg-band p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-ink">
                      {KIND_LABEL[k]}
                      {k === "car" ? <span className="font-normal text-muted"> (optional)</span> : null}
                    </p>
                    {have.has(k) ? <StatusPill tone="success">✓ Added</StatusPill> : null}
                  </div>
                  <PhotoCapture userId={user.id} inspectionId={x.id} kind={k} label={have.has(k) ? `Add another ${KIND_LABEL[k].toLowerCase()} photo` : `Take ${KIND_LABEL[k].toLowerCase()} photo`} />
                </li>
              ))}
            </ul>
          </section>
          <section className={cardClasses({ className: "mt-4" })}>
            <h2 className="font-display text-lg font-bold text-ink">2. Your report</h2>
            <div className="mt-3">
              <ReportForm inspectionId={x.id} ready={ready} />
            </div>
          </section>
        </>
      )}
    </DashboardShell>
  );
}
