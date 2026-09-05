import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonClasses } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { cn } from "@/lib/utils";
import type { FeeResponsibility, VehicleStatus } from "@/types/database";
import { submitForReview } from "./actions";
import { SubmitForReviewButton } from "./submit-for-review-button";

const STATUS_META: Record<VehicleStatus, { label: string; pill: string }> = {
  draft: { label: "Draft", pill: "bg-paper-200 text-ink-400" },
  pending_review: { label: "Pending review", pill: "bg-marine-50 text-marine-700" },
  approved: { label: "Approved", pill: "" },
  rejected: { label: "Rejected", pill: "bg-copper-50 text-copper-700" },
  sold: { label: "Sold", pill: "bg-ink-100 text-ink-700" },
  archived: { label: "Archived", pill: "bg-paper-200 text-ink-400" },
};

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const FEE_LABEL: Record<FeeResponsibility, string> = {
  buyer_pays_full: "Buyer pays MOVA's full 8% fee",
  split: "MOVA's 8% fee split 50/50 with the buyer",
};

function StatusBadge({ status }: { status: VehicleStatus }) {
  if (status === "approved") {
    return <VerifiedBadge label="Approved" />;
  }
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-sm font-medium",
        meta.pill
      )}
    >
      {meta.label}
    </span>
  );
}

export default async function SellerListingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: listings } = await supabase
    .from("vehicles")
    .select("*")
    .eq("seller_id", user!.id)
    .order("created_at", { ascending: false });

  const rows = listings ?? [];

  // Reservations where the buyer has already paid MOVA's service fee — the
  // seller should now expect direct contact and a wire for the vehicle price.
  const vehicleIds = rows.map((v) => v.id);
  const { data: paidReqs } = vehicleIds.length
    ? await supabase
        .from("purchase_requests")
        .select("vehicle_id, vehicle_price_usd, seller_details_revealed_at")
        .in("vehicle_id", vehicleIds)
        .eq("mova_fee_payment_status", "paid")
        .order("seller_details_revealed_at", { ascending: false })
    : { data: [] };

  const paidByVehicle = new Map<string, { vehicle_price_usd: number | null }>();
  for (const p of paidReqs ?? []) {
    if (!paidByVehicle.has(p.vehicle_id)) {
      paidByVehicle.set(p.vehicle_id, { vehicle_price_usd: p.vehicle_price_usd });
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-ink-900">My listings</h1>
        <Link href="/seller/listings/new" className={buttonClasses({ size: "sm" })}>
          New listing
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-paper-200 bg-paper-100 p-10 text-center">
          <p className="text-ink-900">No listings yet.</p>
          <p className="mt-1 text-sm text-slate-500">
            Add your first vehicle to get it in front of buyers.
          </p>
          <Link
            href="/seller/listings/new"
            className={cn(buttonClasses({ size: "sm" }), "mt-4")}
          >
            Create a listing
          </Link>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {rows.map((v) => (
            <li
              key={v.id}
              className="rounded-lg border border-paper-200 bg-paper-100 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-ink-900">
                    {v.year} {v.make} {v.model}
                    {v.trim ? ` ${v.trim}` : ""}
                  </h2>
                  <p className="mt-1 font-mono text-sm text-ink-400">
                    {usd.format(Number(v.price_usd))} · {v.mileage.toLocaleString("en-US")} mi ·{" "}
                    {v.location_city}, {v.location_state}
                  </p>
                  <p className="mt-1 font-mono text-xs uppercase tracking-wider text-ink-400">
                    VIN {v.vin}
                    {v.vin_decode_status === "mismatch" ? " · VIN mismatch flagged" : ""}
                  </p>
                  <p className="mt-1 text-xs text-ink-400">
                    {FEE_LABEL[v.fee_responsibility]}
                  </p>
                </div>
                <StatusBadge status={v.status} />
              </div>
              {v.status === "rejected" && v.rejection_reason ? (
                <p className="mt-3 text-sm text-copper-700">
                  Reason: {v.rejection_reason}
                </p>
              ) : null}
              {paidByVehicle.has(v.id) ? (
                <p className="mt-3 rounded border border-verified-100 bg-verified-50 p-3 text-sm text-verified-600">
                  Buyer has paid MOVA&rsquo;s service fee — expect direct contact
                  {paidByVehicle.get(v.id)!.vehicle_price_usd != null
                    ? ` for ${usd.format(
                        Number(paidByVehicle.get(v.id)!.vehicle_price_usd),
                      )}`
                    : ""}
                  .
                </p>
              ) : null}
              {v.status === "draft" ? (
                <form action={submitForReview} className="mt-4">
                  <input type="hidden" name="id" value={v.id} />
                  <SubmitForReviewButton />
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
