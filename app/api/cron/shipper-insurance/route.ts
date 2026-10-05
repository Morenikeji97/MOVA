import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { dueReminder, isoDay } from "@/lib/shipper-verification";
import { notifyShipperCoiReminder } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily shipper insurance check, called at 07:00 UTC by the pg_cron job
 * 'shipper-insurance-expiry' (0060) with the shared CRON_SECRET — same shape
 * as /api/cron/release-reservations.
 *
 * Hiding an expired shipper needs no job: shipper_is_bookable() compares the
 * expiry date with today on every read. This only sends the reminders —
 * 30 days before, 7 days before and on expiry, each once per certificate
 * (coi_reminder_stage, cleared when a new certificate is sent).
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
  const today = isoDay(new Date());
  const in30 = isoDay(new Date(Date.now() + 30 * 86_400_000));
  const { data: rows, error } = await admin
    .from("shippers")
    .select("id, coi_expires_on, coi_reminder_stage")
    .eq("coi_status", "approved")
    .eq("is_test", false)
    .not("coi_expires_on", "is", null)
    .lte("coi_expires_on", in30)
    .limit(500);
  if (error) {
    console.error("shipper insurance check failed:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let sent = 0;
  for (const s of rows ?? []) {
    const stage = dueReminder(s.coi_expires_on!, today, s.coi_reminder_stage);
    if (!stage) continue;
    // Record first so a retry can't email twice; read back to be sure.
    const res = await admin
      .from("shippers")
      .update({ coi_reminder_stage: stage })
      .eq("id", s.id)
      .select("coi_reminder_stage");
    if (res.error || res.data?.[0]?.coi_reminder_stage !== stage) {
      console.error(`shipper ${s.id}: reminder stage not saved`, res.error);
      continue;
    }
    if (await notifyShipperCoiReminder(s.id, stage, s.coi_expires_on!)) sent++;
  }

  if (sent > 0) {
    revalidatePath("/admin/shippers");
    revalidatePath("/browse", "layout");
  }
  return NextResponse.json({ ok: true, checked: rows?.length ?? 0, sent });
}
