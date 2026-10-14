/**
 * ShipMova — who gets an email at each deal stage, and what it says
 * (founder, 2026-10-09: "email notifications at every deal stage — buyer,
 * seller, shipper, inspector").
 *
 * Pure (no imports): lib/notifications.ts notifyDealEvent() loads the deal
 * and sends these. One table, so every stage's emails are in one place and
 * tested together. Copy rules: short, one action, the deal reference and the
 * car; never bank details or a request to pay a person (scam warning on
 * every money step); ShipMova never holds the car price — Escrow.com does.
 */

export type DealRole = "buyer" | "seller" | "shipper" | "inspector";

export type DealEvent =
  | "reservation_submitted"
  | "reservation_under_review"
  | "reservation_released"
  | "fee_requested"
  | "fee_paid"
  | "escrow_opened"
  | "escrow_funded"
  | "inspection_assigned"
  | "inspection_passed"
  | "inspection_failed"
  | "handed_to_shipper"
  | "escrow_released"
  | "shipment_created"
  | "shipping_escrow_opened"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "inspector_paid";

export type DealEmailContext = {
  /** "SM-000001" (or "" before it has one). */
  reference: string;
  /** "2015 Toyota Camry". */
  car: string;
  /** Shipper company, when the deal has one. */
  shipper?: string | null;
  /** Inspector pay, when relevant. */
  payUsd?: number | null;
};

export type DealEmail = {
  to: DealRole;
  subject: string;
  heading: string;
  /** Plain sentences; the sender escapes and wraps them. */
  lines: string[];
  cta: { label: string; path: string };
};

const SCAM =
  "ShipMova will never send you bank details by email, WhatsApp or text, or ask you to pay a person directly. If anyone does, it's a scam — stop and message us.";

const BUYER_HOME = { label: "Open your dashboard", path: "/buyer/dashboard" };
const SELLER_HOME = { label: "Open your reservations", path: "/seller/reservations" };
const SHIPPER_HOME = { label: "Open your shipments", path: "/shipper/dashboard" };
const INSPECTOR_HOME = { label: "Open your inspections", path: "/inspector" };

const ref = (c: DealEmailContext) => (c.reference ? `${c.reference} · ` : "");
const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The emails for one event, in send order. */
export function dealEmails(event: DealEvent, c: DealEmailContext): DealEmail[] {
  const car = c.car;
  switch (event) {
    case "reservation_submitted":
      return [
        {
          to: "buyer",
          subject: `${ref(c)}Reservation received — ${car}`,
          heading: "Reservation received",
          lines: [`ShipMova has your reservation for the ${car}. We review it and tell you the next step here and on your dashboard.`],
          cta: BUYER_HOME,
        },
        {
          to: "seller",
          subject: `${ref(c)}A buyer reserved your ${car}`,
          heading: "Your car was reserved",
          lines: [`A buyer reserved your ${car}. ShipMova reviews the reservation first; nothing is paid yet.`],
          cta: SELLER_HOME,
        },
      ];
    case "reservation_under_review":
      return [
        {
          to: "buyer",
          subject: `${ref(c)}ShipMova is reviewing your reservation`,
          heading: "Your reservation is in review",
          lines: [`ShipMova is reviewing your reservation for the ${car}. Next you'll get the link to pay ShipMova's fee.`],
          cta: BUYER_HOME,
        },
      ];
    case "reservation_released":
      return [
        {
          to: "buyer",
          subject: `${ref(c)}Your reservation was released — ${car}`,
          heading: "Reservation released",
          lines: [`Your reservation for the ${car} has been released. Nothing more is owed on it.`],
          cta: { label: "Browse vehicles", path: "/browse" },
        },
        {
          to: "seller",
          subject: `${ref(c)}A reservation on your ${car} was released`,
          heading: "Reservation released",
          lines: [`The reservation on your ${car} has been released. If the listing is live, buyers can reserve it again.`],
          cta: SELLER_HOME,
        },
      ];
    case "fee_requested":
      return [
        {
          to: "buyer",
          subject: `${ref(c)}Pay ShipMova's fee to continue — ${car}`,
          heading: "Your fee payment link is ready",
          lines: [
            `Your reservation for the ${car} is approved. Pay ShipMova's fee from your dashboard to continue — card or bank transfer to ShipMova's own account shown there.`,
            SCAM,
          ],
          cta: BUYER_HOME,
        },
      ];
    case "fee_paid":
      // The buyer's confirmation is notifyFeePaymentConfirmed (existing).
      return [
        {
          to: "seller",
          subject: `${ref(c)}The buyer paid ShipMova's fee — ${car}`,
          heading: "The buyer paid ShipMova's fee",
          lines: [`The buyer of your ${car} paid ShipMova's fee. Next they pay the car price into Escrow.com — you're paid from escrow after inspection and handover to their shipper.`],
          cta: SELLER_HOME,
        },
      ];
    case "escrow_opened":
      return [
        {
          to: "buyer",
          subject: `${ref(c)}Pay the car price into Escrow.com — ${car}`,
          heading: "Escrow is open",
          lines: [
            `The Escrow.com transaction for the ${car} is open. Escrow.com emails you how to pay — you pay Escrow.com, never the seller or ShipMova.`,
            SCAM,
          ],
          cta: BUYER_HOME,
        },
        {
          to: "seller",
          subject: `${ref(c)}Escrow is open for your ${car}`,
          heading: "Escrow is open",
          lines: [`The Escrow.com transaction for your ${car} is open. Escrow.com emails you to agree; the buyer then pays into escrow.`],
          cta: SELLER_HOME,
        },
      ];
    case "escrow_funded":
      return [
        {
          to: "buyer",
          subject: `${ref(c)}Your payment is in escrow — ${car}`,
          heading: "Your payment is in escrow",
          lines: [`Escrow.com holds the price of the ${car}. Next an independent inspector checks the car at pickup.`],
          cta: BUYER_HOME,
        },
        {
          to: "seller",
          subject: `${ref(c)}The buyer funded escrow — ${car}`,
          heading: "The buyer funded escrow",
          lines: [`The price of your ${car} is held by Escrow.com. Next an inspector checks the car at pickup; ShipMova sends you the time.`],
          cta: SELLER_HOME,
        },
      ];
    case "inspection_assigned":
      return [
        {
          to: "inspector",
          subject: `${ref(c)}New inspection: ${car}`,
          heading: "You have a new inspection",
          lines: [`ShipMova assigned you the ${car}. Open the job for the details; ShipMova sends you the pickup time and address.`],
          cta: INSPECTOR_HOME,
        },
      ];
    case "inspection_passed":
      return [
        {
          to: "buyer",
          subject: `${ref(c)}Inspection passed — ${car}`,
          heading: "Inspected at pickup ✓",
          lines: [`An inspector checked the ${car} in person: VIN, odometer and title. Next your shipper collects it with the title.`],
          cta: BUYER_HOME,
        },
        {
          to: "seller",
          subject: `${ref(c)}Inspection passed — ${car}`,
          heading: "Inspection passed",
          lines: [`Your ${car} passed inspection. Next the buyer's shipper collects it with the original title.`],
          cta: SELLER_HOME,
        },
        {
          to: "inspector",
          subject: `${ref(c)}Your report was accepted — ${car}`,
          heading: "Report accepted",
          lines: [
            `ShipMova accepted your inspection of the ${car}.${c.payUsd != null ? ` Your pay of ${usd(c.payUsd)} is recorded as owed.` : ""}`,
          ],
          cta: INSPECTOR_HOME,
        },
      ];
    case "inspection_failed":
      return [
        {
          to: "buyer",
          subject: `${ref(c)}The inspection found a problem — ${car}`,
          heading: "Inspection didn't pass",
          lines: [`The inspection of the ${car} didn't pass. ShipMova will contact you about what happens next. Your money stays in escrow.`],
          cta: BUYER_HOME,
        },
        {
          to: "seller",
          subject: `${ref(c)}The inspection found a problem — ${car}`,
          heading: "Inspection didn't pass",
          lines: [`The inspection of your ${car} didn't pass. ShipMova will contact you about what happens next.`],
          cta: SELLER_HOME,
        },
        {
          to: "inspector",
          subject: `${ref(c)}Your report was accepted — ${car}`,
          heading: "Report accepted",
          lines: [
            `ShipMova reviewed your inspection of the ${car}.${c.payUsd != null ? ` Your pay of ${usd(c.payUsd)} is recorded as owed.` : ""}`,
          ],
          cta: INSPECTOR_HOME,
        },
      ];
    case "handed_to_shipper":
      return [
        {
          to: "buyer",
          subject: `${ref(c)}Your shipper has the car and title — ${car}`,
          heading: "Your shipper has the car",
          lines: [`${c.shipper ?? "Your shipper"} has the ${car} and its original title. Escrow.com releases the price to the seller next.`],
          cta: BUYER_HOME,
        },
        {
          to: "seller",
          subject: `${ref(c)}Handed to the shipper — ${car}`,
          heading: "Handed to the shipper",
          lines: [`Your ${car} and its title are with the buyer's shipper. Escrow.com releases your payment next.`],
          cta: SELLER_HOME,
        },
      ];
    case "escrow_released":
      return [
        {
          to: "seller",
          subject: `${ref(c)}Escrow released your payment — ${car}`,
          heading: "Payment released",
          lines: [`Escrow.com released the price of your ${car} to you. Thank you for selling on ShipMova.`],
          cta: SELLER_HOME,
        },
        {
          to: "buyer",
          subject: `${ref(c)}Escrow released to the seller — ${car}`,
          heading: "Sale complete",
          lines: [`Escrow.com released the price of the ${car} to the seller. Your shipper keeps you updated until it arrives.`],
          cta: BUYER_HOME,
        },
      ];
    case "shipment_created":
      return [
        {
          to: "shipper",
          subject: `${ref(c)}New shipment: ${car}`,
          heading: "A buyer chose your rate",
          lines: [`A buyer chose your rate to ship the ${car}. Their contact details are in your shipments.`],
          cta: SHIPPER_HOME,
        },
      ];
    case "shipping_escrow_opened":
      return [
        {
          to: "buyer",
          subject: `${ref(c)}Pay shipping into Escrow.com — ${car}`,
          heading: "Shipping escrow is open",
          lines: [
            `The Escrow.com transaction for shipping the ${car} is open. Escrow.com emails you how to pay — never pay the shipper directly.`,
            SCAM,
          ],
          cta: BUYER_HOME,
        },
        {
          to: "shipper",
          subject: `${ref(c)}Shipping escrow is open — ${car}`,
          heading: "Shipping escrow is open",
          lines: [`The Escrow.com transaction for shipping the ${car} is open. Escrow.com emails you to agree; you're paid at pickup and at bill of lading.`],
          cta: SHIPPER_HOME,
        },
      ];
    case "picked_up":
    case "in_transit":
    case "delivered": {
      const what = { picked_up: "picked up", in_transit: "on its way", delivered: "delivered" }[event];
      return [
        {
          to: "buyer",
          subject: `${ref(c)}Your car is ${what} — ${car}`,
          heading: `Your car is ${what}`,
          lines: [`${c.shipper ?? "Your shipper"} marked the ${car} as ${what}.`],
          cta: BUYER_HOME,
        },
      ];
    }
    case "inspector_paid":
      return [
        {
          to: "inspector",
          subject: `${ref(c)}You've been paid — ${car}`,
          heading: "Inspection paid",
          lines: [`ShipMova marked your inspection of the ${car} as paid${c.payUsd != null ? ` (${usd(c.payUsd)})` : ""}.`],
          cta: INSPECTOR_HOME,
        },
      ];
  }
}

/** Escrow stage (purchase_requests.escrow_stage) -> its email event. */
export const ESCROW_STAGE_EVENT: Record<string, DealEvent> = {
  escrow_opened: "escrow_opened",
  escrow_funded: "escrow_funded",
  handed_to_shipper: "handed_to_shipper",
  escrow_released: "escrow_released",
  // inspection_passed is emailed by the inspection decision itself.
};
