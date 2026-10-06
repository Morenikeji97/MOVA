import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncEscrowTransaction } from "@/lib/escrow-sync";
import { webhookTransactionId } from "@/lib/escrow-com";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Escrow.com webhook (registered once on ShipMova's Escrow.com account as
 * https://shipmova.com/api/escrow/webhook?key=<ESCROW_WEBHOOK_KEY>).
 *
 * Escrow.com doesn't sign webhooks, so:
 *   - the key in the URL keeps random callers out;
 *   - nothing in the body is trusted — it only says which transaction to
 *     re-fetch from Escrow.com (lib/escrow-sync.ts), and what Escrow.com
 *     returns is what's recorded.
 * Every call is logged in escrow_webhook_events (admin-readable).
 */
function keyMatches(given: string | null): boolean {
  const expected = process.env.ESCROW_WEBHOOK_KEY;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!keyMatches(new URL(request.url).searchParams.get("key"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // logged below as unreadable
  }
  const transactionId = webhookTransactionId(body);
  const eventType =
    body && typeof body === "object"
      ? String((body as Record<string, unknown>).event_type ?? (body as Record<string, unknown>).event ?? "").slice(0, 100) || null
      : null;

  const admin = createAdminClient();
  const { data: logged } = await admin
    .from("escrow_webhook_events")
    .insert({ transaction_id: transactionId, event_type: eventType })
    .select("id")
    .single();

  const result = transactionId
    ? await syncEscrowTransaction(transactionId, admin)
    : { ok: false as const, message: "no transaction id in the webhook" };
  if (logged) {
    await admin
      .from("escrow_webhook_events")
      .update({ result: `${result.ok ? "ok" : "error"}: ${result.message}`.slice(0, 500), processed_at: new Date().toISOString() })
      .eq("id", logged.id);
  }
  if (result.ok) {
    revalidatePath("/admin/reservations");
    revalidatePath("/admin/shipments");
    revalidatePath("/buyer/dashboard");
  }
  // 200 even when the sync failed: it's logged for staff, and Escrow.com
  // retrying the same unsigned call wouldn't change the outcome.
  return NextResponse.json({ received: true });
}
