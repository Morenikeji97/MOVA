import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, renderEmailShell } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { appUrl } from "@/lib/app-url";

/**
 * Email notifications for the moments buyers/sellers/shippers need to know
 * about, per trigger. Every function here is self-contained (does its own
 * admin-client lookups) and never throws — `sendEmail` itself never throws,
 * and every lookup below is defensive (a missing row/email just means no
 * email goes out, not an error surfaced to the caller). Call sites can
 * `await` these without a try/catch and without risking the underlying
 * action (message sent, payment recorded, status changed) failing because
 * a notification couldn't be built or sent.
 *
 * All recipient-email lookups go through the service-role client
 * (createAdminClient) regardless of which client the calling action itself
 * uses — "users read own" RLS means a regular session can only read its own
 * row, never the other party's email.
 */

function vehicleTitle(v: { year: number; make: string; model: string; trim?: string | null }) {
  return `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`;
}

const usdCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

// ── Chat ─────────────────────────────────────────────────────────────────

/**
 * New chat message. Debounced per (conversation, recipient) — at most one
 * email every 5 minutes regardless of how many messages arrive in that
 * window, reusing the same check_rate_limit RPC the rate-limiting feature
 * added (migration 0024) as a debounce primitive: max_count=1 within
 * window_seconds is exactly "don't notify again until this much time has
 * passed."
 */
export async function notifyNewChatMessage(
  conversationId: string,
  recipientId: string,
): Promise<void> {
  const allowed = await checkRateLimit(`chat-notify:${conversationId}:${recipientId}`, 1, 300);
  if (!allowed) return;

  const admin = createAdminClient();
  const { data: conversation } = await admin
    .from("conversations")
    .select("vehicle_id, buyer_id, seller_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conversation) return;

  const [{ data: recipient }, { data: vehicle }] = await Promise.all([
    admin.from("users").select("email").eq("id", recipientId).maybeSingle(),
    admin
      .from("vehicles")
      .select("year, make, model, trim")
      .eq("id", conversation.vehicle_id)
      .maybeSingle(),
  ]);
  if (!recipient?.email || !vehicle) return;

  const isBuyerRecipient = recipientId === conversation.buyer_id;
  const origin = await appUrl();
  const link = isBuyerRecipient
    ? `${origin}/browse/${conversation.vehicle_id}`
    : `${origin}/seller/messages/${conversationId}`;

  await sendEmail({
    to: recipient.email,
    subject: `New message about the ${vehicleTitle(vehicle)}`,
    html: renderEmailShell({
      heading: "New message",
      bodyHtml: `<p style="margin:0;">You have a new message about the ${vehicleTitle(vehicle)}.</p>`,
      ctaLabel: "View conversation",
      ctaHref: link,
    }),
  });
}

// ── Fee payment ──────────────────────────────────────────────────────────

/**
 * MOVA facilitation fee confirmed as paid — covers both trigger paths
 * (Stripe card payment, admin bank-transfer confirmation), since both land
 * on the exact same event: mova_fee_payment_status = 'paid'.
 */
export async function notifyFeePaymentConfirmed(purchaseRequestId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: pr } = await admin
    .from("purchase_requests")
    .select("buyer_id, vehicle_id")
    .eq("id", purchaseRequestId)
    .maybeSingle();
  if (!pr) return;

  const [{ data: buyer }, { data: vehicle }] = await Promise.all([
    admin.from("users").select("email").eq("id", pr.buyer_id).maybeSingle(),
    admin.from("vehicles").select("year, make, model, trim").eq("id", pr.vehicle_id).maybeSingle(),
  ]);
  if (!buyer?.email || !vehicle) return;

  const origin = await appUrl();
  await sendEmail({
    to: buyer.email,
    subject: `Fee confirmed — seller contact for the ${vehicleTitle(vehicle)}`,
    html: renderEmailShell({
      heading: "Payment confirmed",
      bodyHtml: `<p style="margin:0;">Your MOVA service fee for the ${vehicleTitle(vehicle)} is confirmed. The seller&rsquo;s contact details are ready on your dashboard.</p>`,
      ctaLabel: "View seller contact",
      ctaHref: `${origin}/buyer/dashboard`,
    }),
  });
}

// ── Reservation status changes ───────────────────────────────────────────

/** Auto-released for non-payment (lib/auto-release.ts / the release cron). */
export async function notifyReservationExpired(purchaseRequestId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: pr } = await admin
    .from("purchase_requests")
    .select("buyer_id, vehicle_id")
    .eq("id", purchaseRequestId)
    .maybeSingle();
  if (!pr) return;

  const [{ data: buyer }, { data: vehicle }] = await Promise.all([
    admin.from("users").select("email").eq("id", pr.buyer_id).maybeSingle(),
    admin.from("vehicles").select("year, make, model, trim").eq("id", pr.vehicle_id).maybeSingle(),
  ]);
  if (!buyer?.email || !vehicle) return;

  const origin = await appUrl();
  await sendEmail({
    to: buyer.email,
    subject: `Your reservation expired — ${vehicleTitle(vehicle)}`,
    html: renderEmailShell({
      heading: "Reservation expired",
      bodyHtml: `<p style="margin:0;">Your reservation for the ${vehicleTitle(vehicle)} expired because payment wasn&rsquo;t completed in time. You can reserve it again if it&rsquo;s still available.</p>`,
      ctaLabel: "Browse vehicles",
      ctaHref: `${origin}/browse`,
    }),
  });
}

/** Seller proposed (or revised) a negotiated price — app/chat/actions.ts. */
export async function notifyNegotiatedPriceProposed(
  purchaseRequestId: string,
  priceUsd: number,
): Promise<void> {
  const admin = createAdminClient();
  const { data: pr } = await admin
    .from("purchase_requests")
    .select("buyer_id, vehicle_id")
    .eq("id", purchaseRequestId)
    .maybeSingle();
  if (!pr) return;

  const [{ data: buyer }, { data: vehicle }] = await Promise.all([
    admin.from("users").select("email").eq("id", pr.buyer_id).maybeSingle(),
    admin.from("vehicles").select("year, make, model, trim").eq("id", pr.vehicle_id).maybeSingle(),
  ]);
  if (!buyer?.email || !vehicle) return;

  const origin = await appUrl();
  await sendEmail({
    to: buyer.email,
    subject: `New price offer — ${vehicleTitle(vehicle)}`,
    html: renderEmailShell({
      heading: "The seller sent a new price",
      bodyHtml: `<p style="margin:0;">The seller offered ${usdCents.format(priceUsd)} for the ${vehicleTitle(vehicle)}. Review it on your dashboard.</p>`,
      ctaLabel: "Review offer",
      ctaHref: `${origin}/buyer/dashboard`,
    }),
  });
}

/** Admin rejected a buyer's bank-transfer proof. */
export async function notifyBankTransferRejected(
  purchaseRequestId: string,
  reason: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data: pr } = await admin
    .from("purchase_requests")
    .select("buyer_id, vehicle_id")
    .eq("id", purchaseRequestId)
    .maybeSingle();
  if (!pr) return;

  const [{ data: buyer }, { data: vehicle }] = await Promise.all([
    admin.from("users").select("email").eq("id", pr.buyer_id).maybeSingle(),
    admin.from("vehicles").select("year, make, model, trim").eq("id", pr.vehicle_id).maybeSingle(),
  ]);
  if (!buyer?.email || !vehicle) return;

  const origin = await appUrl();
  await sendEmail({
    to: buyer.email,
    subject: `Bank transfer needs another look — ${vehicleTitle(vehicle)}`,
    html: renderEmailShell({
      heading: "We couldn't confirm your transfer",
      bodyHtml: `<p style="margin:0 0 8px;">MOVA couldn&rsquo;t confirm your bank transfer for the ${vehicleTitle(vehicle)}: ${reason}</p><p style="margin:0;">You can upload new proof or pay by card instead.</p>`,
      ctaLabel: "Try again",
      ctaHref: `${origin}/buyer/dashboard`,
    }),
  });
}

// ── Reviews ──────────────────────────────────────────────────────────────

/** A review about you was published — app/reviews/actions.ts moderateReview. */
export async function notifyNewReview(reviewId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: review } = await admin
    .from("reviews")
    .select("reviewee_id, reviewee_shipper_id, rating")
    .eq("id", reviewId)
    .maybeSingle();
  if (!review) return;

  let email: string | null = null;
  if (review.reviewee_id) {
    const { data } = await admin
      .from("users")
      .select("email")
      .eq("id", review.reviewee_id)
      .maybeSingle();
    email = data?.email ?? null;
  } else if (review.reviewee_shipper_id) {
    const { data } = await admin
      .from("shippers")
      .select("contact_email")
      .eq("id", review.reviewee_shipper_id)
      .maybeSingle();
    email = data?.contact_email ?? null;
  }
  if (!email) return;

  const origin = await appUrl();
  await sendEmail({
    to: email,
    subject: "You received a new review on MOVA",
    html: renderEmailShell({
      heading: "New review",
      bodyHtml: `<p style="margin:0;">You received a ${review.rating}-star review on MOVA.</p>`,
      ctaLabel: "View your reviews",
      ctaHref: origin,
    }),
  });
}

// ── Disputes ─────────────────────────────────────────────────────────────

/** A dispute was filed against the other party on this reservation. */
export async function notifyDisputeFiled(
  purchaseRequestId: string,
  reporterId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data: pr } = await admin
    .from("purchase_requests")
    .select("buyer_id, vehicle_id")
    .eq("id", purchaseRequestId)
    .maybeSingle();
  if (!pr) return;

  const { data: vehicle } = await admin
    .from("vehicles")
    .select("year, make, model, trim, seller_id")
    .eq("id", pr.vehicle_id)
    .maybeSingle();
  if (!vehicle) return;

  // The other party — whoever on this reservation didn't file the report.
  const recipientId = reporterId === pr.buyer_id ? vehicle.seller_id : pr.buyer_id;
  const { data: recipient } = await admin
    .from("users")
    .select("email")
    .eq("id", recipientId)
    .maybeSingle();
  if (!recipient?.email) return;

  const origin = await appUrl();
  const isSellerRecipient = recipientId === vehicle.seller_id;
  await sendEmail({
    to: recipient.email,
    subject: `A dispute was filed — ${vehicleTitle(vehicle)}`,
    html: renderEmailShell({
      heading: "A dispute was filed",
      bodyHtml: `<p style="margin:0;">A dispute was filed regarding the ${vehicleTitle(vehicle)}. MOVA will review it and reach a decision.</p>`,
      ctaLabel: "View details",
      ctaHref: `${origin}${isSellerRecipient ? "/seller/reservations" : "/buyer/dashboard"}`,
    }),
  });
}

/** Admin approved (for refund) or denied a dispute. */
export async function notifyDisputeDecision(disputeId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: dispute } = await admin
    .from("disputes")
    .select("reporter_id, purchase_request_id, status, decision_reason")
    .eq("id", disputeId)
    .maybeSingle();
  if (!dispute || (dispute.status !== "approved_pending_refund" && dispute.status !== "denied")) {
    return;
  }

  const { data: pr } = await admin
    .from("purchase_requests")
    .select("buyer_id, vehicle_id")
    .eq("id", dispute.purchase_request_id)
    .maybeSingle();
  if (!pr) return;

  const [{ data: reporter }, { data: vehicle }] = await Promise.all([
    admin.from("users").select("email").eq("id", dispute.reporter_id).maybeSingle(),
    admin.from("vehicles").select("year, make, model, trim").eq("id", pr.vehicle_id).maybeSingle(),
  ]);
  if (!reporter?.email || !vehicle) return;

  const approved = dispute.status === "approved_pending_refund";
  const origin = await appUrl();
  const reporterIsBuyer = dispute.reporter_id === pr.buyer_id;
  await sendEmail({
    to: reporter.email,
    subject: `Dispute decision — ${vehicleTitle(vehicle)}`,
    html: renderEmailShell({
      heading: approved ? "Your dispute was approved" : "Your dispute was denied",
      bodyHtml: `<p style="margin:0;">${
        approved
          ? "MOVA approved your dispute for a refund."
          : `MOVA reviewed your dispute and didn&rsquo;t approve it${dispute.decision_reason ? `: ${dispute.decision_reason}` : "."}`
      }</p>`,
      ctaLabel: "View details",
      ctaHref: `${origin}${reporterIsBuyer ? "/buyer/dashboard" : "/seller/reservations"}`,
    }),
  });
}
