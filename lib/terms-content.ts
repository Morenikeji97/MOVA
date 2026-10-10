/**
 * Raw markdown source for the Terms & Conditions, rendered by
 * /terms/accept via the minimal parser in components/ui/markdown-lite.tsx
 * (headings, paragraphs, "*.../_..._" italic lines, "- " bullet lists,
 * "1. " numbered lists, and inline "**bold**" spans).
 *
 * Version v1.3, effective 2026-10-31 (launch day — confirm before merging) — matches CURRENT_TERMS_VERSION in
 * lib/terms.ts. Bump that constant (not this file's own text) whenever this
 * content changes in a way that requires re-acceptance; see lib/terms.ts's
 * doc comment for the mechanism.
 *
 * Section 15 ("Legal Notice") is this document's own attorney-review flag —
 * it lists open legal questions still pending review, not a placeholder for
 * this feature's plumbing (that placeholder has been replaced with ShipMova's
 * actual Terms & Conditions text).
 */
export const TERMS_AND_CONDITIONS_MARKDOWN = `
# ShipMova Terms & Conditions

*Last updated: 2026-10-31*

## 1. Acceptance of Terms & Scope

These Terms and Conditions ("Terms") govern access to and use of the ShipMova platform, including the website located at shipmova.com and any related applications (collectively, the "Platform"), operated by ShipMova LLC ("ShipMova," "we," "us," or "our").

By creating an account on the Platform — as a Buyer, Seller, or Shipper — you agree to be bound by these Terms, our Buyer Protection & Refund Policy, and our Privacy Policy (together, the "Agreements"). If you do not agree to these Terms, you may not register for or use the Platform.

**Every account type — Buyer, Seller, and Shipper — must affirmatively accept these Terms before gaining any access to the Platform.** Acceptance is recorded with the date, time, IP address, and version of the Terms accepted, and this record is retained as part of your account for as long as it exists.

These Terms apply to all users of the Platform regardless of location, including users accessing the Platform from Nigeria, Ghana, Togo, Benin, the United States, or elsewhere.

## 2. What ShipMova Is (and Isn't)

ShipMova is a technology platform that connects U.S.-based vehicle sellers with buyers in Nigeria, Ghana, Togo, and Benin, and helps both sides coordinate with licensed and independent shipping providers.

**ShipMova is not:**

- A seller of any vehicle listed on the Platform
- A party to any sale, purchase, or shipping agreement formed between users
- A vehicle dealer, broker, or auctioneer
- A shipping company, freight forwarder, or customs agent
- The holder or recipient of any payment for a vehicle's purchase price or for shipping (ShipMova collects only its own facilitation fee; the vehicle price and the shipping price are each held by Escrow.com, a licensed escrow company)
- A guarantor of any vehicle's condition, any seller's title, or any shipper's performance

ShipMova's role is limited to identity and listing verification, coordinating the escrow payment described in Section 4, collecting its own fee, and the tools (chat, reviews, dispute reporting) that support a transaction. The vehicle price and condition are agreed between Buyer and Seller through the Platform, and the terms of shipping are agreed between Buyer and Shipper, with the shipping price paid through Escrow.com as described in Section 4.

ShipMova's facilitation fee (see Section 4) compensates ShipMova for verification, coordination, and platform services — it is never a commission, markup, or payment on the vehicle itself.

## 3. Eligibility & Account Registration

You must be at least 18 years old and able to form a legally binding contract in your jurisdiction to register for or use the Platform.

The Platform supports three account types, each with its own obligations under these Terms:

1. **Buyer accounts** — for individuals seeking to purchase a vehicle listed on the Platform.
2. **Seller accounts** — for individuals or businesses listing a vehicle they own and have the legal right to sell.
3. **Shipper accounts** — for companies or individuals offering vehicle shipping services between the United States and ShipMova's supported destination countries.

You agree to provide accurate, current, and complete information when registering, to keep that information up to date, and to complete any identity or account verification ShipMova requires (see Section 9). ShipMova may decline to open, may suspend, or may close any account at its discretion, including where verification cannot be completed or where these Terms are violated.

You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. Notify ShipMova immediately if you suspect unauthorized use of your account.

## 4. Fees, Payment & Escrow

ShipMova charges a facilitation fee equal to 8% of a vehicle's price on each completed sale. The Seller chooses, per listing, whether the Buyer pays the full 8% or the fee is split 50/50. Where it is split, the Buyer pays 4% to ShipMova and the Seller's 4% is deducted from the Seller's escrow payout; the Seller pays nothing upfront. The applicable fee is always shown in full before payment.

**How payment works:**

1. **ShipMova's facilitation fee.** The Buyer pays ShipMova's facilitation fee through the Platform's payment processor (currently Stripe) or, where enabled, via bank transfer with uploaded proof subject to manual review. This fee is paid to ShipMova, not to the Seller.
2. **The vehicle price, held in escrow.** The Buyer pays the vehicle price into an escrow transaction with Escrow.com, a licensed escrow company — never to the Seller or to ShipMova directly. Escrow.com's own fee is paid by the Buyer and shown separately, as an estimate, before payment.
3. **Release to the Seller.** Escrow.com releases the vehicle price to the Seller only after the vehicle has passed an independent inspection and the Buyer's chosen Shipper has taken custody of the vehicle and its original title.
4. **Shipping, held in escrow.** The Buyer pays the shipping price into a separate escrow transaction with Escrow.com — never to the Shipper or to ShipMova directly. ShipMova arranges the transaction as a broker and does not hold, process, or guarantee the payment. The shipping price is split into two milestones: the inland portion (collection from the Seller and transport to the port), released to the Shipper at pickup, and the ocean freight, released to the Shipper at the bill of lading. When the Shipper marks a milestone complete with Escrow.com, the Buyer has five (5) days to raise a problem with Escrow.com; if the Buyer does not, Escrow.com releases that milestone to the Shipper. Escrow.com's fee for the shipping transaction is paid by the Buyer and shown separately. Disputes about a milestone are handled under Escrow.com's dispute process.

Paying ShipMova's facilitation fee does not release either party's contact information. ShipMova will never ask a Buyer to pay a Seller or any individual directly, will never send payment instructions by WhatsApp, email, or text message, and will never change payment instructions after a purchase has started.

All fees charged by ShipMova are quoted and charged in U.S. Dollars. ShipMova is not responsible for currency conversion rates, foreign transaction fees, or charges imposed by a Buyer's or Seller's own bank or payment provider (see Section 12).

ShipMova's facilitation fee is refundable only as provided in ShipMova's Buyer Protection & Refund Policy, which governs refund eligibility and takes precedence over any conflicting statement in these Terms on that subject.

## 5. Buyer Responsibilities

As a Buyer, you agree that:

- You will independently review each listing, including photos, VIN status, and any disclosed history, before paying ShipMova's facilitation fee.
- You will pay for the vehicle only into escrow as described in Section 4, never to the Seller directly, and you will pay your chosen Shipper only through the shipping escrow described in Section 4, never directly. Within five (5) days of a Shipper marking a shipping milestone complete, you will raise any problem with Escrow.com, or that milestone is released.
- You are solely responsible for complying with all import, customs, duty, tax, titling, and registration requirements of your destination country. ShipMova does not handle customs clearance, import duties, or destination-country registration, and makes no representation that any vehicle can be lawfully imported, registered, or driven in your destination country.
- You will not attempt to transact with a Seller outside the Platform, or pay a Seller directly, to avoid ShipMova's facilitation fee or the escrow process.
- You are not located in, and are not a national or resident of, any country or region subject to comprehensive U.S. sanctions, and you are not listed on any U.S. government denied-parties or sanctions list, including lists maintained by the U.S. Department of the Treasury's Office of Foreign Assets Control (OFAC) (see Section 12).
- Any information you provide for identity or payment verification is accurate and belongs to you.

## 6. Seller Responsibilities

As a Seller, you agree that:

- You are the legal owner of any vehicle you list, or are authorized by the legal owner to sell it, and you hold or can obtain a title free of any undisclosed lien or encumbrance.
- All information in your listing — including the VIN, mileage, price, condition, photos, and video — is accurate and not misleading. Knowingly listing a vehicle with a false VIN, undisclosed salvage or flood history, or materially misrepresented condition is a violation of these Terms and may result in immediate account termination and forfeiture of any pending facilitation fee.
- You will cooperate with ShipMova's listing review process, including providing title documentation and any information reasonably requested to verify the vehicle and your identity.
- You will accept payment for the vehicle only through the escrow process described in Section 4, will hand the vehicle's original title to the Buyer's Shipper at pickup, and are responsible for transferring title in accordance with the laws of the state where the vehicle is titled.
- You will not ask a Buyer to pay you directly, or attempt to transact with a Buyer outside the Platform, to avoid ShipMova's facilitation fee or the escrow process.
- If a vehicle is found to be materially misrepresented under ShipMova's Buyer Protection & Refund Policy, you acknowledge that ShipMova may refund its facilitation fee to the affected Buyer and may take further action against your account, up to and including permanent suspension.

## 7. Shipper Responsibilities

As a Shipper, you agree that:

- You hold all licenses, permits, insurance, and authorizations required to lawfully transport and export vehicles from the United States to the destination countries you list.
- The rates, destinations, vehicle-size categories, and methods you publish on the Platform are accurate and honored for any Buyer who books based on them.
- You are solely responsible for the physical pickup, export documentation, ocean or air transport, customs handoff, and delivery of any vehicle you agree to ship, and for any loss or damage occurring during that process.
- You will provide status updates and, where applicable, proof-of-pickup and proof-of-delivery photos through the Platform for each shipment you handle.
- You will accept payment for shipping only through the Escrow.com shipping transaction described in Section 4, never directly from a Buyer, and will not ask a Buyer to pay you outside it. You will mark a milestone complete with Escrow.com only after uploading its proof to the Platform — proof of pickup for the inland portion, and the bill of lading for the ocean freight — and you will keep your inland and ocean prices accurate on your rates. ShipMova does not process, hold, or guarantee payment for shipping services.
- ShipMova's display of your company profile, rates, and reviews does not constitute an endorsement, guarantee, or warranty of your services by ShipMova.

## 8. Prohibited Conduct

You agree not to:

- Circumvent ShipMova's facilitation fee or the escrow process by moving a transaction off-Platform, including by sharing phone numbers, email addresses, WhatsApp handles, bank details, or other contact details in Platform chat.
- List, attempt to buy, or attempt to ship a stolen vehicle, a vehicle with a knowingly falsified VIN or title, or a vehicle whose export or import would violate U.S. or destination-country law.
- Provide false, misleading, or impersonated identity, business, or verification information.
- Harass, threaten, or discriminate against another user.
- Post fake reviews, manipulate ratings, or retaliate against a user for an honest review.
- Use the Platform for any purpose that violates applicable law, including export control, sanctions, anti-money-laundering, or consumer-protection law.
- Scrape, reverse-engineer, or use automated means to access the Platform outside its intended use.

Violation of this section may result in immediate suspension or termination of your account, forfeiture of pending fees, and, where applicable, referral to law enforcement.

## 9. Verification, KYC & Disclaimers

ShipMova uses third-party services (including Stripe Identity for Seller identity checks, and providers such as Dojah, Youverify, or Prembly for Buyer NIN/BVN checks in supported countries) to verify user identity. ShipMova does not store raw national ID or bank verification numbers; it stores only the verification status returned by these providers.

ShipMova manually checks a listed VIN against free public and semi-public resources, including the National Insurance Crime Bureau's VINCheck (theft/salvage) and the National Motor Vehicle Title Information System via vehiclehistory.gov (title branding), and reviews title documentation and vehicle photos submitted by the Seller before approving a listing.

**These checks have limits.** A "VIN Verified" badge, an "Approved" listing status, or a completed identity check means ShipMova performed the applicable check and found no issue at the time of review — it is not a guarantee that a vehicle is free of undisclosed damage, liens, or history, that a Seller's identity information is free of fraud, or that a Shipper is properly licensed in every jurisdiction it serves. ShipMova disclaims any warranty, express or implied, arising from these checks, to the fullest extent permitted by law.

## 10. Reviews & Ratings

Buyers and Sellers may review each other after a completed transaction; Buyers may review Shippers after a completed shipment. Reviews must reflect genuine experience, may not contain contact information, and are subject to ShipMova's moderation, including removal of reviews that violate this section or are found on report to contain prohibited content. ShipMova does not guarantee the accuracy of any review and is not liable for the content of user-submitted reviews.

## 11. Disclaimer of Warranties; Limitation of Liability; Indemnification

**Disclaimer of warranties.** The Platform is provided "as is" and "as available," without warranty of any kind, express or implied, including merchantability, fitness for a particular purpose, and non-infringement. ShipMova does not warrant that the Platform will be uninterrupted, secure, or error-free, or that any vehicle, Seller, Buyer, or Shipper will perform as represented.

**Limitation of liability.** To the fullest extent permitted by law, ShipMova's total liability to you for any claim arising out of or relating to these Terms or the Platform — whether in contract, tort, or otherwise — is limited to the total facilitation fees you paid to ShipMova in the twelve (12) months before the claim arose. In no event will ShipMova be liable for indirect, incidental, consequential, special, or punitive damages, or for lost profits, lost data, or the cost of a substitute vehicle or shipment, even if advised of the possibility of such damages. This limitation applies regardless of the number of claims and does not limit ShipMova's obligations, if any, under its Buyer Protection & Refund Policy.

**Indemnification.** You agree to indemnify and hold ShipMova, its officers, employees, and agents harmless from any claim, loss, or expense (including reasonable attorneys' fees) arising from your breach of these Terms, your listing or purchase of a vehicle, your provision of shipping services, or your violation of any law or third-party right.

## 12. Sanctions, Export Compliance & International Use

You represent that you are not located in, organized under the laws of, or ordinarily resident in any country or region subject to comprehensive sanctions administered by the U.S. Department of the Treasury's Office of Foreign Assets Control (OFAC), and that you do not appear on OFAC's Specially Designated Nationals list or any other applicable U.S. denied-persons or restricted-party list. ShipMova may deny service, suspend an account, or decline a transaction where necessary to comply with U.S. export control or sanctions law.

Export of a vehicle from the United States is subject to U.S. Department of Commerce and U.S. Customs and Border Protection requirements, including Automated Export System (AES) filing. Responsibility for AES filing and for presenting a valid, unencumbered title at export rests with the Shipper handling that vehicle's export, as agreed between Buyer and Shipper — ShipMova does not file export documentation and is not a party to that arrangement.

ShipMova makes no representation that use of the Platform, or import of a vehicle purchased through it, complies with the law of every country from which the Platform may be accessed. If you access the Platform from outside the United States, you do so on your own initiative and are responsible for compliance with local law, including any restrictions on used-vehicle import, age limits, or left-hand-drive requirements in your destination country.

## 13. Governing Law, Language & Dispute Resolution

These Terms are governed by the laws of the State of New York, without regard to its conflict-of-laws rules. You agree that any dispute arising out of or relating to these Terms or the Platform that is not resolved through ShipMova's internal dispute process (below) will be brought exclusively in the state or federal courts located in Nassau County, New York, and you consent to personal jurisdiction there.

*Note: whether disputes should instead be subject to mandatory arbitration is a separate decision pending attorney review — this venue clause is a placeholder, not a final position.*

These Terms are written in English. Where ShipMova provides a translation of these Terms or any Platform content into French or another language, the English version controls in the event of any conflict or ambiguity.

ShipMova provides an in-Platform process for reporting a dispute over a transaction (for example, a materially misrepresented vehicle or an undelivered shipment). ShipMova's administrators review reported disputes and may approve a facilitation-fee refund consistent with the Buyer Protection & Refund Policy; ShipMova's dispute process is a good-faith review mechanism, not binding arbitration, and does not waive either party's other legal rights or remedies.

## 14. Intellectual Property; Third-Party Services; Termination; Changes; Miscellaneous

**Intellectual property.** The ShipMova name, logo, and Platform design are the property of ShipMova. Listing content (photos, descriptions, video) remains the property of the Seller who submitted it, but by posting it, the Seller grants ShipMova a license to display it on the Platform for the purpose of operating the marketplace.

**Third-party services.** The Platform relies on third-party services, including Stripe (payments and identity verification), Resend (email), and KYC providers such as Dojah, Youverify, and Prembly. ShipMova is not responsible for outages, errors, or decisions made by these third-party providers, including a payment being declined or an identity check being delayed.

**Termination.** ShipMova may suspend or terminate your account, with or without notice, for violation of these Terms, suspected fraud, or as required by law. You may close your account at any time by contacting ShipMova; closing your account does not affect fees already earned or obligations already incurred.

**Changes to these Terms.** ShipMova may update these Terms from time to time. Material changes will be reflected by an updated "Last updated" date, and continued use of the Platform after a change takes effect constitutes acceptance of the revised Terms. Where required, ShipMova will request renewed acceptance from active accounts.

**Severability & entire agreement.** If any provision of these Terms is found unenforceable, the remaining provisions remain in full effect. These Terms, together with the Buyer Protection & Refund Policy and Privacy Policy, constitute the entire agreement between you and ShipMova regarding use of the Platform.

**Contact.** Questions about these Terms can be sent to support@shipmova.com.

## 15. Legal Notice

*Draft — pending New York attorney review. This document has not been reviewed by a licensed attorney and should not be treated as final. The following items should be confirmed or resolved before this document is relied on as ShipMova's final Terms and Conditions:*

- Whether Section 13 disputes should proceed in Nassau County, New York courts (as currently drafted) or be subject to mandatory arbitration with a class-action waiver.
- Whether the liability cap in Section 11 is enforceable against consumer buyers domiciled in Nigeria, Ghana, Togo, and Benin, and what residual exposure ShipMova retains if a foreign court or regulator declines to honor it.
- Whether the federal odometer disclosure requirement (49 CFR Part 580) is fully satisfied by the Seller certification flow elsewhere on the Platform, and whether these Terms should cross-reference it directly as a Seller obligation.
- Confirmation that collecting ShipMova's own fee and coordinating Escrow.com transactions for the vehicle price and for shipping (as broker, never holding funds) does not constitute money transmission requiring licensure in any U.S. state, and review of the terms of ShipMova's arrangement with Escrow.com.
- Whether the click-to-accept acceptance flow satisfies the U.S. ESIGN Act and UETA requirements for a valid electronic signature.
- Whether a force majeure clause is needed to address shipping, customs, or port delays outside any party's control.
- Whether Nigeria's NDPR, Ghana's Data Protection Act, or similar law in Togo or Benin requires disclosures beyond what is in ShipMova's Privacy Policy.
- Any additional cross-border consumer-protection disclosures required for buyers in Nigeria, Ghana, Togo, or Benin.
`;
