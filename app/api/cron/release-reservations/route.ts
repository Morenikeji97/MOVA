import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAutoReleaseStatus } from "@/lib/auto-release";
import type { Database } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PurchaseRequestUpdate =
  Database["public"]["Tables"]["purchase_requests"]["Update"];

const OPEN_STATUSES = ["submitted", "under_review", "verified"] as const;

/**
 * Abandoned-reservation auto-release. Hit every 15 minutes by a Supabase
 * pg_cron job (0021_release_reservations_cron.sql) via pg_net, authenticated
 * with a shared secret (CRON_SECRET) rather than a user session — same
 * "no request-scoped user, service-role client" shape as the Stripe
 * webhooks, and for the same reason: purchase_requests_guard_negotiation
 * (0011/0018/0020) would silently discard a write from any caller it
 * doesn't recognize as admin/service-role/the row's own buyer, and a bare
 * pg_cron SQL job has none of those — see 0021's header comment.
 *
 * The actual timeout rule lives in lib/auto-release.ts (shared with the
 * admin/buyer UI); this route only fetches candidates and applies it.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set.");
    return new NextResponse("Not configured", { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("purchase_requests")
    .select("id, mova_fee_payment_status, fee_payment_requested_at, bank_transfer_reviewed_at")
    .in("status", OPEN_STATUSES)
    .not("fee_payment_requested_at", "is", null)
    .neq("mova_fee_payment_status", "paid");

  if (error) {
    console.error("release-reservations: fetch failed:", error);
    return new NextResponse("Database read failed", { status: 500 });
  }

  const now = new Date();
  const idsToRelease = (rows ?? [])
    .filter(
      (r) =>
        getAutoReleaseStatus(
          {
            feePaymentRequestedAt: r.fee_payment_requested_at,
            movaFeePaymentStatus: r.mova_fee_payment_status,
            bankTransferReviewedAt: r.bank_transfer_reviewed_at,
          },
          now,
        ).state === "due_for_release",
    )
    .map((r) => r.id);

  if (idsToRelease.length > 0) {
    const update: PurchaseRequestUpdate = { status: "expired" };
    const { error: updateError } = await admin
      .from("purchase_requests")
      .update(update)
      .in("id", idsToRelease)
      // Re-check against a race with a payment that just completed between
      // the select above and this update.
      .neq("mova_fee_payment_status", "paid");

    if (updateError) {
      console.error("release-reservations: update failed:", updateError);
      return new NextResponse("Database update failed", { status: 500 });
    }

    revalidatePath("/admin/reservations");
    revalidatePath("/buyer/dashboard");
  }

  return NextResponse.json({ released: idsToRelease.length });
}
