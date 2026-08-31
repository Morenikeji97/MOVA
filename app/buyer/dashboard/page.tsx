import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const RESERVATION_STATUS_COPY: Record<string, string> = {
  submitted: "Submitted — waiting for MOVA to review.",
  under_review: "MOVA is reviewing your request.",
  verified: "Verified — MOVA will be in touch with next steps.",
  completed: "Completed.",
  rejected: "Not accepted.",
  cancelled: "Released.",
};

export default async function BuyerDashboard() {
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
      .select("id, vehicle_id, status, created_at")
      .eq("buyer_id", user!.id)
      .order("created_at", { ascending: false }),
  ]);

  const profile = profileData;
  const reservations = reservationRows ?? [];

  const vehicleIds = [...new Set(reservations.map((r) => r.vehicle_id))];
  const { data: vehicleRows } = vehicleIds.length
    ? await supabase
        .from("vehicles")
        .select("id, year, make, model, trim, price_usd")
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
                      {vehicle ? (
                        <p className="mt-1 font-mono text-sm text-ink-400">
                          {usd.format(Number(vehicle.price_usd))}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {RESERVATION_STATUS_COPY[r.status] ?? r.status}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
