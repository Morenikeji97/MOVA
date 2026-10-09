import { type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StarRating } from "@/components/ui/star-rating";
import { REVIEW_TYPE_LABEL } from "@/lib/reviews";
import type { ReviewStatus } from "@/types/database";
import { ModerationActions } from "./moderation-actions";
import { BackLink, DashboardShell } from "@/components/ui/dashboard";

const fmtDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const QUEUE_STATUSES: ReviewStatus[] = ["pending", "flagged"];

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}

export default async function AdminReviewsPage() {
  const supabase = await createClient();

  const { data: reviewRows } = await supabase
    .from("reviews")
    .select(
      "id, review_type, reviewer_id, reviewee_id, reviewee_shipper_id, rating, comment, status, created_at",
    )
    .in("status", QUEUE_STATUSES)
    .order("created_at", { ascending: true });

  const reviews = reviewRows ?? [];
  const reviewIds = reviews.map((r) => r.id);
  const userIds = [
    ...new Set(
      reviews.flatMap((r) => [r.reviewer_id, r.reviewee_id].filter(Boolean) as string[]),
    ),
  ];
  const shipperIds = [
    ...new Set(reviews.map((r) => r.reviewee_shipper_id).filter(Boolean) as string[]),
  ];

  const [usersRes, shippersRes, reportsRes] = await Promise.all([
    userIds.length
      ? supabase.from("users").select("id, email").in("id", userIds)
      : null,
    shipperIds.length
      ? supabase.from("shippers").select("id, company_name").in("id", shipperIds)
      : null,
    reviewIds.length
      ? supabase
          .from("review_reports")
          .select("review_id, reason, status, created_at")
          .in("review_id", reviewIds)
          .eq("status", "open")
          .order("created_at", { ascending: true })
      : null,
  ]);

  const emailById = new Map((usersRes?.data ?? []).map((u) => [u.id, u.email]));
  const companyById = new Map(
    (shippersRes?.data ?? []).map((s) => [s.id, s.company_name]),
  );
  const reportsByReview = new Map<string, { reason: string | null; created_at: string }[]>();
  for (const rep of reportsRes?.data ?? []) {
    const list = reportsByReview.get(rep.review_id) ?? [];
    list.push({ reason: rep.reason, created_at: rep.created_at });
    reportsByReview.set(rep.review_id, list);
  }

  return (
    <DashboardShell>
      <BackLink href="/admin/dashboard">Admin dashboard</BackLink>
      <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-ink">
        Review moderation queue
      </h1>
      <p className="mt-2 text-sm text-muted">
        {reviews.length === 0
          ? "Nothing waiting for moderation."
          : `${reviews.length} review${reviews.length === 1 ? "" : "s"} awaiting a decision.`}{" "}
        New reviews land here before they&rsquo;re public; reported reviews come
        back here flagged.
      </p>

      {reviews.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-line bg-white p-10 text-center">
          <p className="text-ink">The queue is clear.</p>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {reviews.map((r) => {
            const reports = reportsByReview.get(r.id) ?? [];
            const reviewee =
              r.reviewee_id != null
                ? emailById.get(r.reviewee_id) ?? "—"
                : r.reviewee_shipper_id != null
                  ? companyById.get(r.reviewee_shipper_id) ?? "—"
                  : "—";
            const isFlagged = r.status === "flagged";

            return (
              <li
                key={r.id}
                className="rounded-card border border-line bg-white shadow-card p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <StarRating value={r.rating} size="sm" />
                      <span className="text-sm font-semibold text-ink">
                        {r.rating}/5
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                      {REVIEW_TYPE_LABEL[r.review_type]}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-sm font-medium ${
                      isFlagged
                        ? "bg-copper-50 text-copper-700"
                        : "bg-marine-50 text-marine-700"
                    }`}
                  >
                    {isFlagged ? `Flagged · ${reports.length} report${reports.length === 1 ? "" : "s"}` : "Pending"}
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                  <Detail label="Reviewer">
                    {emailById.get(r.reviewer_id) ?? "—"}
                  </Detail>
                  <Detail label="Reviewee">{reviewee}</Detail>
                  <Detail label="Submitted">
                    {fmtDate.format(new Date(r.created_at))}
                  </Detail>
                </dl>

                {r.comment ? (
                  <p className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-line bg-white p-3 text-sm text-muted">
                    {r.comment}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-muted">No comment.</p>
                )}

                {reports.length > 0 ? (
                  <div className="mt-3 rounded-lg border border-copper-100 bg-copper-50 p-3">
                    <p className="font-mono text-xs uppercase tracking-wider text-copper-700">
                      Reports
                    </p>
                    <ul className="mt-1 flex flex-col gap-1 text-sm text-copper-700">
                      {reports.map((rep, i) => (
                        <li key={i}>
                          {rep.reason?.trim() || "(no reason given)"} —{" "}
                          {fmtDate.format(new Date(rep.created_at))}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <ModerationActions reviewId={r.id} isFlagged={isFlagged} />
              </li>
            );
          })}
        </ul>
      )}
    </DashboardShell>
  );
}

export const dynamic = "force-dynamic";
