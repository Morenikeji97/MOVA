import { DISPUTE_CATEGORY_LABEL, DISPUTE_STATUS_LABEL } from "@/lib/disputes";
import type { DisputeCategory, DisputeStatus } from "@/types/database";

export type DisputeSummary = {
  id: string;
  category: DisputeCategory;
  status: DisputeStatus;
  description: string;
  decision_reason: string | null;
  decision_amount_usd: number | null;
  reporter_id: string;
  created_at: string;
};

const usdCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const STATUS_STYLE: Record<DisputeStatus, string> = {
  open: "border-marine-100 bg-marine-50 text-marine-700",
  approved_pending_refund: "border-verified-100 bg-verified-50 text-verified-600",
  refund_completed: "border-verified-100 bg-verified-50 text-verified-600",
  denied: "border-copper-100 bg-copper-50 text-copper-700",
};

/**
 * Read-only dispute banner(s) for a reservation — same "surface the status
 * inline, no real notifications yet" pattern as the bank-transfer rejection
 * banner on the buyer dashboard. Shown identically to whichever side is
 * viewing (buyer dashboard or seller reservations page); `currentUserId`
 * just flips "you reported this" vs "the other party reported this" copy.
 */
export function DisputeStatusList({
  disputes,
  currentUserId,
}: {
  disputes: DisputeSummary[];
  currentUserId: string;
}) {
  if (disputes.length === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-2">
      {disputes.map((d) => (
        <div
          key={d.id}
          className={`rounded border p-3 text-sm ${STATUS_STYLE[d.status]}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">
              {DISPUTE_CATEGORY_LABEL[d.category]} —{" "}
              {d.reporter_id === currentUserId ? "reported by you" : "reported by the other party"}
            </p>
            <span className="font-mono text-xs uppercase tracking-wider">
              {DISPUTE_STATUS_LABEL[d.status]}
            </span>
          </div>
          {d.status === "open" ? (
            <p className="mt-1 text-gray-500">
              MOVA is reviewing this dispute — usually within 5 business days.
            </p>
          ) : null}
          {d.decision_reason ? (
            <p className="mt-1">
              {d.status === "denied" ? "Reason: " : "Decision: "}
              {d.decision_reason}
              {d.decision_amount_usd != null
                ? ` (${usdCents.format(Number(d.decision_amount_usd))})`
                : ""}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
