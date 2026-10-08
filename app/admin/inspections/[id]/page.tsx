import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PHOTO_FLAG_LABEL, type PhotoFlag } from "@/lib/inspection-checks";
import { EXCLUSION_LABEL, type ExclusionReason } from "@/lib/inspector-assignment";
import { DecideInspectionForm, MarkPaidForm } from "../forms";
import { BackLink, DashboardShell } from "@/components/ui/dashboard";

export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });

/**
 * One inspection report for an admin: what the inspector read vs the
 * listing, the photo checks, each photo with its map location, and the
 * pass/fail decision (which records the inspector's 2% pay). Photos are
 * private: short-lived links made here after the authenticator check.
 */
export default async function AdminInspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireAdmin())) redirect(`/login?next=/admin/inspections/${id}`);
  const admin = createAdminClient();
  const { data: x } = await admin.from("inspections").select("*").eq("id", id).maybeSingle();
  if (!x) notFound();
  const [{ data: inspector }, { data: pr }, { data: photos }] = await Promise.all([
    admin.from("inspectors").select("full_name, phone").eq("id", x.inspector_id).maybeSingle(),
    admin.from("purchase_requests").select("reference, vehicle_id").eq("id", x.purchase_request_id).maybeSingle(),
    admin.from("inspection_photos").select("id, kind, storage_path, latitude, longitude, accuracy_m, captured_at").eq("inspection_id", x.id).order("uploaded_at"),
  ]);
  const { data: car } = pr
    ? await admin.from("vehicles").select("year, make, model, vin, mileage, location_city, location_state").eq("id", pr.vehicle_id).maybeSingle()
    : { data: null };
  const links = new Map<string, string>();
  for (const p of photos ?? []) {
    const { data } = await admin.storage.from("inspection-photos").createSignedUrl(p.storage_path, 300);
    if (data?.signedUrl) links.set(p.id, data.signedUrl);
  }
  const vinMatches = car?.vin && x.vin_read ? car.vin.toUpperCase() === x.vin_read.toUpperCase() : null;
  const note = (x.assignment_note ?? {}) as { eligible?: number; excluded?: Partial<Record<ExclusionReason, number>>; rotation_relaxed?: boolean };

  return (
    <DashboardShell narrow>
      <BackLink href="/admin/reservations">Reservations</BackLink>
      <p className="mt-4 font-mono text-xs text-muted">{pr?.reference}</p>
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
        Inspection · {car ? `${car.year} ${car.make} ${car.model}` : "car"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        Status: <strong className="text-ink">{x.status}</strong> · Inspector {inspector?.full_name} ({inspector?.phone}) · Car in {car?.location_city}, {car?.location_state}
      </p>
      <p className="mt-1 text-sm text-muted">
        Picked at random from {note.eligible ?? "?"} eligible{note.rotation_relaxed ? " (all had inspected this seller recently)" : ""}
        {note.excluded && Object.keys(note.excluded).length
          ? ` · excluded: ${Object.entries(note.excluded).map(([k, n]) => `${EXCLUSION_LABEL[k as ExclusionReason] ?? k} (${n})`).join(", ")}`
          : ""}
      </p>

      {x.status !== "assigned" ? (
        <section className="mt-6 rounded-card border border-line bg-white shadow-card p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Report</h2>
          <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">VIN read on the car</dt>
              <dd className={`font-mono ${vinMatches === false ? "text-copper-700" : "text-ink"}`}>
                {x.vin_read} {vinMatches === true ? "✓ matches listing" : vinMatches === false ? `✗ listing says ${car?.vin}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Odometer</dt>
              <dd className="text-ink">
                {x.odometer_reading?.toLocaleString("en-US")} mi (listing: {car?.mileage?.toLocaleString("en-US") ?? "—"})
              </dd>
            </div>
            <div>
              <dt className="text-muted">Title VIN matches the car</dt>
              <dd className={x.title_matches ? "text-ink" : "text-copper-700"}>{x.title_matches ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-muted">Sent</dt>
              <dd className="text-ink">{x.submitted_at ? `${when.format(new Date(x.submitted_at))} UTC` : "—"}</dd>
            </div>
          </dl>
          {x.condition_notes ? <p className="mt-2 text-sm text-ink">{x.condition_notes}</p> : null}
          <p className={`mt-3 text-sm ${x.photo_check_flags.length ? "text-copper-700" : "text-verified-600"}`}>
            {x.photo_check_flags.length
              ? `Photo checks: ${x.photo_check_flags.map((f: string) => PHOTO_FLAG_LABEL[f as PhotoFlag] ?? f).join("; ")}`
              : "Photo checks: all located, within 1 km and 3 hours of each other, after assignment."}
          </p>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Photos ({photos?.length ?? 0})</h2>
        <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(photos ?? []).map((p) => (
            <li key={p.id} className="rounded-lg border border-line bg-white p-2">
              {links.get(p.id) ? (
                // eslint-disable-next-line @next/next/no-img-element -- private, short-lived link
                <img src={links.get(p.id)} alt={`Inspection photo: ${p.kind}`} loading="lazy" className="max-h-72 w-full rounded object-contain" />
              ) : (
                <p className="text-sm text-copper-700">Photo couldn&rsquo;t be loaded.</p>
              )}
              <p className="mt-1 text-sm text-ink">{p.kind}</p>
              <p className="text-xs text-muted">
                {p.captured_at ? `${when.format(new Date(p.captured_at))} UTC` : "no time"} ·{" "}
                {p.latitude != null && p.longitude != null ? (
                  <a
                    href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 items-center underline"
                  >
                    map (±{Math.round(p.accuracy_m ?? 0)} m)
                  </a>
                ) : (
                  "no location"
                )}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {x.status === "submitted" ? (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Decision</h2>
          <p className="mt-1 text-sm text-muted">
            Either way the inspector&rsquo;s pay ({Number(x.pay_pct)}% of the car price) is recorded as owed. Passing marks the deal &ldquo;Inspection passed&rdquo; and shows the buyer and seller &ldquo;Inspected at pickup ✓&rdquo;.
          </p>
          <div className="mt-3">
            <DecideInspectionForm inspectionId={x.id} />
          </div>
        </section>
      ) : null}

      {x.pay_status !== "none" ? (
        <section className="mt-6 rounded-card border border-line bg-white shadow-card p-4">
          <p className="text-sm text-ink">
            Inspector pay: <strong>${Number(x.pay_usd).toFixed(2)}</strong> — {x.pay_status === "paid" ? "paid" : "owed"}
          </p>
          {x.pay_status === "owed" ? (
            <div className="mt-2">
              <MarkPaidForm inspectionId={x.id} />
            </div>
          ) : null}
        </section>
      ) : null}
    </DashboardShell>
  );
}
