# Proposal: shipping payments through Escrow.com (buyers never pay shippers directly)

Status: **proposal — founder to decide.** Nothing here is built. Written 2026-10-05.

## Why

Today a buyer picks a shipper's rate on ShipMova, then pays the shipper
directly. That leaves the buyer exposed on the second-largest payment in the
deal: a shipper can take the money and not load the car, or hold the car at
the port for more. ShipMova's rule is that it never holds anyone's money
(the car price already goes through Escrow.com), so shipping should too.

## The constraint

An Escrow.com transaction has at most **one buyer, one seller, one broker and
one partner** ([API docs](https://www.escrow.com/api/docs/create-transaction)).
So the shipper can't be a second payee inside the car's transaction. A
"shipping fee" line in that transaction is paid to the *car seller*, who'd
then have to pay the shipper. That puts the money with the wrong person.

## Options

| | How | Buyer protected? | ShipMova holds money? | Verdict |
|---|---|---|---|---|
| **A. Second Escrow.com transaction for shipping** | Buyer → Escrow.com → shipper, as a **milestone** transaction | Yes, released on proof | No | **Recommended** |
| B. Shipping as a fee in the car transaction | Escrow.com pays the car seller, who pays the shipper | Partly | No | No: the seller becomes the shipper's paymaster |
| C. ShipMova collects shipping and pays shippers | ShipMova account in the middle | Yes | **Yes** | No: breaks "ShipMova never custodies funds" and brings money-transmitter licensing |
| D. Keep direct payment, add insurance and reviews only | Day 3's gate (COI, FMC, ratings) | Weakly | No | Interim only |

## Recommended: A, a separate milestone transaction per shipment

- Created when the buyer confirms a shipper's rate. ShipMova is the **broker**
  on both transactions, so it sees status but never holds money.
- **Milestones** (founder to choose the split):
  1. **Car collected and loaded:** released on the shipper's dock receipt or
     bill of lading uploaded in ShipMova and checked by ShipMova. Suggested 50%.
  2. **Car released at the destination port:** released when the buyer
     confirms in ShipMova, or automatically N days after the vessel's
     arrival if the buyer stays silent. Suggested 50%.
- Disputes use Escrow.com's own process. ShipMova's dispute record links to it.
- The shipper needs an Escrow.com account (Escrow.com does their KYC). That
  becomes part of the shipper verification gate, after COI and FMC.

## Costs and trade-offs

- Escrow.com fees apply **per transaction**: a second fee on every deal,
  plus a per-disbursement wire fee to the shipper ($10 domestic or $20
  international per disbursement; ACH suggested for milestones). Who pays,
  buyer or shipper, is a founder decision. Shippers may price it in.
- Shippers wait for milestones instead of being paid up front. Some may
  refuse; the gate shows buyers which shippers accept escrow.
- Depends on the **Escrow.com integration**, which isn't built yet (the car
  price is tracked by reference and stage, entered by an admin). Until then,
  shipping escrow would be the same: admin-entered reference and stage per
  shipment, using the stage history from #37.

## What it would take (if approved)

1. Data: an `escrow_reference` / `escrow_stage` per **shipment** (like
   purchase_requests in #37), and milestone evidence (bill of lading upload,
   buyer's "car released" confirmation) with audit trail.
2. Shipper gate: "Accepts Escrow.com payment" checkbox plus Escrow.com
   account email; only those shippers are bookable once switched on.
3. Copy: the buyer's shipping step says "You pay shipping into Escrow.com —
   never to the shipper directly."
4. **Legal text:** the Terms ("Shipping": paid "directly between
   themselves, outside the Platform", and the "not the holder of any payment"
   list) and the Privacy Policy (shipping payment "happens directly between
   those users") both say the opposite today. They need new versions (Terms
   v1.3), which makes every user re-accept on next sign-in.
5. Later, with the Escrow.com API integration: create both transactions
   automatically and read milestone status by webhook.

## Decisions for the founder

1. Option A? (recommended)
2. Milestone split: 50/50, or 30/70 weighted to arrival?
3. Who pays the second Escrow.com fee: buyer, shipper, or split?
4. Auto-release on arrival if the buyer is silent: how many days? (suggest 7)
5. From launch, or only once the Escrow.com integration exists?
