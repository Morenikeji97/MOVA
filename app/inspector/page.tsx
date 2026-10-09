import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApplyForm } from "./apply-form";

export const metadata: Metadata = { title: "Inspector — ShipMova", robots: { index: false } };
export const dynamic = "force-dynamic";

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
      <main className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-semibold text-black">Inspect cars for ShipMova</h1>
        <p className="mt-2 text-gray-500">
          Inspectors check a car in person at pickup: the VIN plate, the odometer and the title, with
          photos. You&rsquo;re paid 2% of the car&rsquo;s price for each completed inspection.
        </p>
        <ApplyForm />
      </main>
    );
  }
  if (me.status !== "approved") {
    return (
      <main className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-semibold text-black">Inspector application</h1>
        <p className="mt-4 rounded border border-marine-100 bg-marine-50 p-3 text-sm text-marine-700">
          {me.status === "pending"
            ? "ShipMova is reviewing your application."
            : me.status === "suspended"
              ? "Your inspector account is paused. Contact ShipMova."
              : `Your application wasn't approved${me.rejection_reason ? `: ${me.rejection_reason}` : ""}.`}
        </p>
      </main>
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
    <main className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold text-black">Your inspections</h1>
      <p className="mt-1 text-sm text-gray-500">Signed in as {user.email}</p>
      {!rows || rows.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          No inspections assigned yet. ShipMova picks inspectors at random for each car.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {rows.map((r) => {
            const pr = prs?.find((p) => p.id === r.purchase_request_id);
            const car = cars?.find((c) => c.id === pr?.vehicle_id);
            return (
              <li key={r.id}>
                <Link href={`/inspector/${r.id}`} className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-black">
                  <p className="font-mono text-xs text-gray-500">{pr?.reference ?? ""}</p>
                  <p className="font-medium text-black">
                    {car ? `${car.year} ${car.make} ${car.model}` : "Car"} · {car?.location_city}, {car?.location_state}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">{STATUS_LABEL[r.status] ?? r.status}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
