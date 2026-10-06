import type { EscrowItemState } from "@/types/database";
import { ITEM_STATE_LABEL, SHIPPING_MILESTONE_INSPECTION_DAYS } from "@/lib/escrow-com";

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

type Line = { label: string; note: string; amount: number | null; state: EscrowItemState | null };

/**
 * The buyer's payments through Escrow.com for one deal: the car price, and
 * shipping as two milestones, each with Escrow.com's fee as its own line.
 * Everything here is what Escrow.com last reported; ShipMova holds none of it.
 */
export function EscrowPayments({
  car,
  shipping,
}: {
  car: { open: boolean; priceUsd: number | null; state: EscrowItemState | null; feeUsd: number | null };
  shipping: {
    open: boolean;
    inlandUsd: number | null;
    oceanUsd: number | null;
    inlandState: EscrowItemState | null;
    oceanState: EscrowItemState | null;
    feeUsd: number | null;
  } | null;
}) {
  if (!car.open && !shipping?.open) return null;
  const rows: { heading: string; lines: Line[]; feeUsd: number | null }[] = [];
  if (car.open) {
    rows.push({
      heading: "Car price",
      lines: [{ label: "Car", note: "released to the seller after inspection and handover to your shipper", amount: car.priceUsd, state: car.state }],
      feeUsd: car.feeUsd,
    });
  }
  if (shipping?.open) {
    rows.push({
      heading: "Shipping",
      lines: [
        { label: "Inland (pickup to port)", note: "released to the shipper at pickup", amount: shipping.inlandUsd, state: shipping.inlandState },
        { label: "Ocean freight", note: "released to the shipper at bill of lading", amount: shipping.oceanUsd, state: shipping.oceanState },
      ],
      feeUsd: shipping.feeUsd,
    });
  }
  return (
    <div className="mt-3 rounded border border-gray-200 p-4">
      <p className="text-sm font-semibold text-black">Your payments through Escrow.com</p>
      <p className="mt-1 text-sm text-gray-500">
        You pay into Escrow.com, never to the seller, the shipper or ShipMova. Escrow.com emails you
        how to pay. Shipping is released to the shipper {SHIPPING_MILESTONE_INSPECTION_DAYS} days after
        they mark each step done, unless you object to Escrow.com within that time.
      </p>
      {rows.map((r) => (
        <div key={r.heading} className="mt-3">
          <p className="font-mono text-xs uppercase tracking-wider text-gray-500">{r.heading}</p>
          <ul className="mt-1 flex flex-col gap-2">
            {r.lines.map((l) => (
              <li key={l.label} className="text-sm">
                <div className="flex flex-wrap justify-between gap-x-3">
                  <span className="text-black">{l.label}</span>
                  <span className="font-mono text-black">{l.amount != null ? usd(l.amount) : "—"}</span>
                </div>
                <p className="text-gray-500">
                  {ITEM_STATE_LABEL[l.state ?? "awaiting_payment"]} · {l.note}
                </p>
              </li>
            ))}
            <li className="text-sm">
              <div className="flex flex-wrap justify-between gap-x-3">
                <span className="text-black">Escrow.com fee (you pay)</span>
                <span className="font-mono text-black">{r.feeUsd != null ? usd(r.feeUsd) : "set by Escrow.com"}</span>
              </div>
            </li>
          </ul>
        </div>
      ))}
    </div>
  );
}
