/**
 * Raw markdown source for the Terms & Conditions, rendered by
 * /terms/accept via the minimal parser in components/ui/markdown-lite.tsx
 * (headings, paragraphs, "*.../_..._" italic lines, "- " bullet lists,
 * "1. " numbered lists, and inline "**bold**" spans).
 *
 * Version v1.0, effective 2026-09-18 — matches CURRENT_TERMS_VERSION in
 * lib/terms.ts. Bump that constant (not this file's own text) whenever this
 * content changes in a way that requires re-acceptance; see lib/terms.ts's
 * doc comment for the mechanism.
 *
 * Section 15 ("Legal Notice") is this document's own attorney-review flag —
 * it lists open legal questions still pending review, not a placeholder for
 * this feature's plumbing (that placeholder has been replaced with MOVA's
 * actual Terms & Conditions text).
 */
export const TERMS_AND_CONDITIONS_MARKDOWN = `
# MOVA Terms & Conditions

*Last updated: 2026-09-18*

## 1. Acceptance of Terms & Scope

These Terms and Conditions ("Terms") govern access to and use of the MOVA platform, including the website located at shipmova.com and any related applications (collectively, the "Platform"), operated by MOVA ("MOVA," "we," "us," or "our").

By creating an account on the Platform — as a Buyer, Seller, or Shipper — you agree to be bound by these Terms, our Buyer Protection & Refund Policy, and our Privacy Policy (together, the "Agreements"). If you do not agree to these Terms, you may not register for or use the Platform.

**Every account type — Buyer, Seller, and Shipper — must affirmatively accept these Terms before gaining any access to the Platform.** Acceptance is recorded with the date, time, IP address, and version of the Terms accepted, and this record is retained as part of your account for as long as it exists.

These Terms apply to all users of the Platform regardless of location, including users accessing the Platform from Nigeria, Ghana, Togo, Benin, the United States, or elsewhere.

## 2. What MOVA Is (and Isn't)

MOVA is a technology platform that connects U.S.-based vehicle sellers with buyers in Nigeria, Ghana, Togo, and Benin, and helps both sides coordinate with licensed and independent shipping providers.

**MOVA is not:**

- A seller of any vehicle listed on the Platform
- A party to any sale, purchase, or shipping agreement formed between users
- A vehicle dealer, broker, or auctioneer
- A shipping company, freight forwarder, or customs agent
- The recipient of any payment for a vehicle's purchase price (only MOVA's own facilitation fee is paid through the Platform; the vehicle itself is paid for directly between Buyer and Seller, and shipping is paid directly between Buyer and Shipper)
- A guarantor of any vehicle's condition, any seller's title, or any shipper's performance

MOVA's role is limited to identity and listing verification, fee-gated introduction between parties, payment facilitation for its own fee, and the tools (chat, reviews, dispute reporting) that support a transaction. Once a Buyer and Seller are connected, the terms of the vehicle sale — price, condition, payment method, and delivery of title — are negotiated and agreed entirely between them, and the terms of shipping are negotiated and agreed entirely between Buyer and Shipper.

MOVA's facilitation fee (see Section 4) compensates MOVA for verification, coordination, and platform services — it is never a commission, markup, or payment on the vehicle itself.

## 3. Eligibility & Account Registration

You must be at least 18 years old and able to form a legally binding contract in your jurisdiction to register for or use the Platform.

The Platform supports three account types, each with its own obligations under these Terms:

1. **Buyer accounts** — for individuals seeking to purchase a vehicle listed on the Platform.
2. **Seller accounts** — for individuals or businesses listing a vehicle they own and have the legal right to sell.
3. **Shipper accounts** — for companies or individuals offering vehicle shipping services between the United States and MOVA's supported destination countries.

You agree to provide accurate, current, and complete information when registering, to keep that information up to date, and to complete any identity or account verification MOVA requires (see Section 9). MOVA may decline to open, may suspend, or may close any account at its discretion, including where verification cannot be completed or where these Terms are violated.

You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. Notify MOVA immediately if you suspect unauthorized use of your account.

## 4. Fees, Payment & the Two-Invoice Process

MOVA charges a facilitation fee equal to 8% of a vehicle's listed price on each completed introduction between a Buyer and Seller. The Seller chooses, per listing, whether the Buyer pays the full 8% or the fee is split 50/50 between Buyer and Seller. The applicable fee is always shown in full before payment.

**How payment works:**

1. **Invoice 1 — MOVA's facilitation fee.** The Buyer pays MOVA's facilitation fee through the Platform's payment processor (currently Stripe) or, where enabled, via bank transfer with uploaded proof subject to manual review. This fee is paid to MOVA, not to the Seller.
2. **Contact release.** Once Invoice 1 is paid and confirmed, the Seller's contact information is released to the Buyer.
3. **Invoice 2 — the vehicle itself.** The Buyer and Seller arrange payment for the vehicle directly between themselves, outside the Platform. MOVA is not a party to this payment and does not process, hold, or guarantee it.
4. **Shipping.** The Buyer and their chosen Shipper arrange and pay for shipping directly between themselves, outside the Platform. MOVA is not a party to this payment and does not process, hold, or guarantee it.

All fees charged by MOVA are quoted and charged in U.S. Dollars. MOVA is not responsible for currency conversion rates, foreign transaction fees, or charges imposed by a Buyer's or Seller's own bank or payment provider (see Section 12).

MOVA's facilitation fee is generally non-refundable once the Seller's contact information has been released, except as expressly provided in MOVA's Buyer Protection & Refund Policy, which governs refund eligibility and takes precedence over any conflicting statement in these Terms on that subject.

## 5. Buyer Responsibilities

As a Buyer, you agree that:

- You will independently review each listing, including photos, VIN status, and any disclosed history, before paying MOVA's facilitation fee.
- You are solely responsible for negotiating, agreeing to, and paying the Seller for the vehicle, and for negotiating, agreeing to, and paying your chosen Shipper for shipping.
- You are solely responsible for complying with all import, customs, duty, tax, titling, and registration requirements of your destination country. MOVA does not handle customs clearance, import duties, or destination-country registration, and makes no representation that any vehicle can be lawfully imported, registered, or driven in your destination country.
- You will not attempt to contact or transact with a Seller or Shipper outside the Platform to avoid MOVA's facilitation fee before that fee has been paid.
- You are not located in, and are not a national or resident of, any country or region subject to comprehensive U.S. sanctions, and you are not listed on any U.S. government denied-parties or sanctions list, including lists maintained by the U.S. Department of the Treasury's Office of Foreign Assets Control (OFAC) (see Section 12).
- Any information you provide for identity or payment verification is accurate and belongs to you.

## 6. Seller Responsibilities

As a Seller, you agree that:

- You are the legal owner of any vehicle you list, or are authorized by the legal owner to sell it, and you hold or can obtain a title free of any undisclosed lien or encumbrance.
- All information in your listing — including the VIN, mileage, price, condition, photos, and video — is accurate and not misleading. Knowingly listing a vehicle with a false VIN, undisclosed salvage or flood history, or materially misrepresented condition is a violation of these Terms and may result in immediate account termination and forfeiture of any pending facilitation fee.
- You will cooperate with MOVA's listing review process, including providing title documentation and any information reasonably requested to verify the vehicle and your identity.
- You are solely responsible for negotiating, agreeing to, and receiving payment from the Buyer for the vehicle, and for transferring title in accordance with the laws of the state where the vehicle is titled.
- You will not attempt to contact or transact with a Buyer outside the Platform to avoid MOVA's facilitation fee before that fee has been paid.
- If a vehicle is found to be materially misrepresented under MOVA's Buyer Protection & Refund Policy, you acknowledge that MOVA may refund its facilitation fee to the affected Buyer and may take further action against your account, up to and including permanent suspension.

## 7. Shipper Responsibilities

As a Shipper, you agree that:

- You hold all licenses, permits, insurance, and authorizations required to lawfully transport and export vehicles from the United States to the destination countries you list.
- The rates, destinations, vehicle-size categories, and methods you publish on the Platform are accurate and honored for any Buyer who books based on them.
- You are solely responsible for the physical pickup, export documentation, ocean or air transport, customs handoff, and delivery of any vehicle you agree to ship, and for any loss or damage occurring during that process.
- You will provide status updates and, where applicable, proof-of-pickup and proof-of-delivery photos through the Platform for each shipment you handle.
- You are solely responsible for collecting payment for your services directly from the Buyer; MOVA does not process, hold, or guarantee payment for shipping services.
- MOVA's display of your company profile, rates, and reviews does not constitute an endorsement, guarantee, or warranty of your services by MOVA.

## 8. Prohibited Conduct

You agree not to:

- Circumvent MOVA's facilitation fee by moving a transaction off-Platform before contact information is released, including by sharing phone numbers, email addresses, WhatsApp handles, or other contact details in Platform chat before payment.
- List, attempt to buy, or attempt to ship a stolen vehicle, a vehicle with a knowingly falsified VIN or title, or a vehicle whose export or import would violate U.S. or destination-country law.
- Provide false, misleading, or impersonated identity, business, or verification information.
- Harass, threaten, or discriminate against another user.
- Post fake reviews, manipulate ratings, or retaliate against a user for an honest review.
- Use the Platform for any purpose that violates applicable law, including export control, sanctions, anti-money-laundering, or consumer-protection law.
- Scrape, reverse-engineer, or use automated means to access the Platform outside its intended use.

Violation of this section may result in immediate suspension or termination of your account, forfeiture of pending fees, and, where applicable, referral to law enforcement.

## 9. Verification, KYC & Disclaimers

MOVA uses third-party services (including Stripe Identity for Seller identity checks, and providers such as Dojah, Youverify, or Prembly for Buyer NIN/BVN checks in supported countries) to verify user identity. MOVA does not store raw national ID or bank verification numbers; it stores only the verification status returned by these providers.

MOVA manually checks a listed VIN against free public and semi-public resources, including the National Insurance Crime Bureau's VINCheck (theft/salvage) and the National Motor Vehicle Title Information System via vehiclehistory.gov (title branding), and reviews title documentation and vehicle photos submitted by the Seller before approving a listing.

**These checks have limits.** A "VIN Verified" badge, an "Approved" listing status, or a completed identity check means MOVA performed the applicable check and found no issue at the time of review — it is not a guarantee that a vehicle is free of undisclosed damage, liens, or history, that a Seller's identity information is free of fraud, or that a Shipper is properly licensed in every jurisdiction it serves. MOVA disclaims any warranty, express or implied, arising from these checks, to the fullest extent permitted by law.

## 10. Reviews & Ratings

Buyers and Sellers may review each other after a completed transaction; Buyers may review Shippers after a completed shipment. Reviews must reflect genuine experience, may not contain contact information, and are subject to MOVA's moderation, including removal of reviews that violate this section or are found on report to contain prohibited content. MOVA does not guarantee the accuracy of any review and is not liable for the content of user-submitted reviews.

## 11. Disclaimer of Warranties; Limitation of Liability; Indemnification

**Disclaimer of warranties.** The Platform is provided "as is" and "as available," without warranty of any kind, express or implied, including merchantability, fitness for a particular purpose, and non-infringement. MOVA does not warrant that the Platform will be uninterrupted, secure, or error-free, or that any vehicle, Seller, Buyer, or Shipper will perform as represented.

**Limitation of liability.** To the fullest extent permitted by law, MOVA's total liability to you for any claim arising out of or relating to these Terms or the Platform — whether in contract, tort, or otherwise — is limited to the total facilitation fees you paid to MOVA in the twelve (12) months before the claim arose. In no event will MOVA be liable for indirect, incidental, consequential, special, or punitive damages, or for lost profits, lost data, or the cost of a substitute vehicle or shipment, even if advised of the possibility of such damages. This limitation applies regardless of the number of claims and does not limit MOVA's obligations, if any, under its Buyer Protection & Refund Policy.

**Indemnification.** You agree to indemnify and hold MOVA, its officers, employees, and agents harmless from any claim, loss, or expense (including reasonable attorneys' fees) arising from your breach of these Terms, your listing or purchase of a vehicle, your provision of shipping services, or your violation of any law or third-party right.

## 12. Sanctions, Export Compliance & International Use

You represent that you are not located in, organized under the laws of, or ordinarily resident in any country or region subject to comprehensive sanctions administered by the U.S. Department of the Treasury's Office of Foreign Assets Control (OFAC), and that you do not appear on OFAC's Specially Designated Nationals list or any other applicable U.S. denied-persons or restricted-party list. MOVA may deny service, suspend an account, or decline a transaction where necessary to comply with U.S. export control or sanctions law.

Export of a vehicle from the United States is subject to U.S. Department of Commerce and U.S. Customs and Border Protection requirements, including Automated Export System (AES) filing. Responsibility for AES filing and for presenting a valid, unencumbered title at export rests with the Shipper handling that vehicle's export, as agreed between Buyer and Shipper — MOVA does not file export documentation and is not a party to that arrangement.

MOVA makes no representation that use of the Platform, or import of a vehicle purchased through it, complies with the law of every country from which the Platform may be accessed. If you access the Platform from outside the United States, you do so on your own initiative and are responsible for compliance with local law, including any restrictions on used-vehicle import, age limits, or left-hand-drive requirements in your destination country.

## 13. Governing Law, Language & Dispute Resolution

These Terms are governed by the laws of the State of New York, without regard to its conflict-of-laws rules. You agree that any dispute arising out of or relating to these Terms or the Platform that is not resolved through MOVA's internal dispute process (below) will be brought exclusively in the state or federal courts located in Nassau County, New York, and you consent to personal jurisdiction there.

*Note: whether disputes should instead be subject to mandatory arbitration is a separate decision pending attorney review — this venue clause is a placeholder, not a final position.*

These Terms are written in English. Where MOVA provides a translation of these Terms or any Platform content into French or another language, the English version controls in the event of any conflict or ambiguity.

MOVA provides an in-Platform process for reporting a dispute over a transaction (for example, a materially misrepresented vehicle or an undelivered shipment). MOVA's administrators review reported disputes and may approve a facilitation-fee refund consistent with the Buyer Protection & Refund Policy; MOVA's dispute process is a good-faith review mechanism, not binding arbitration, and does not waive either party's other legal rights or remedies.

## 14. Intellectual Property; Third-Party Services; Termination; Changes; Miscellaneous

**Intellectual property.** The MOVA name, logo, and Platform design are the property of MOVA. Listing content (photos, descriptions, video) remains the property of the Seller who submitted it, but by posting it, the Seller grants MOVA a license to display it on the Platform for the purpose of operating the marketplace.

**Third-party services.** The Platform relies on third-party services, including Stripe (payments and identity verification), Resend (email), and KYC providers such as Dojah, Youverify, and Prembly. MOVA is not responsible for outages, errors, or decisions made by these third-party providers, including a payment being declined or an identity check being delayed.

**Termination.** MOVA may suspend or terminate your account, with or without notice, for violation of these Terms, suspected fraud, or as required by law. You may close your account at any time by contacting MOVA; closing your account does not affect fees already earned or obligations already incurred.

**Changes to these Terms.** MOVA may update these Terms from time to time. Material changes will be reflected by an updated "Last updated" date, and continued use of the Platform after a change takes effect constitutes acceptance of the revised Terms. Where required, MOVA will request renewed acceptance from active accounts.

**Severability & entire agreement.** If any provision of these Terms is found unenforceable, the remaining provisions remain in full effect. These Terms, together with the Buyer Protection & Refund Policy and Privacy Policy, constitute the entire agreement between you and MOVA regarding use of the Platform.

**Contact.** Questions about these Terms can be sent to support@shipmova.com.

## 15. Legal Notice

*Draft — pending New York attorney review. This document has not been reviewed by a licensed attorney and should not be treated as final. The following items should be confirmed or resolved before this document is relied on as MOVA's final Terms and Conditions:*

- Whether Section 13 disputes should proceed in Nassau County, New York courts (as currently drafted) or be subject to mandatory arbitration with a class-action waiver.
- Whether the liability cap in Section 11 is enforceable against consumer buyers domiciled in Nigeria, Ghana, Togo, and Benin, and what residual exposure MOVA retains if a foreign court or regulator declines to honor it.
- Whether the federal odometer disclosure requirement (49 CFR Part 580) is fully satisfied by the Seller certification flow elsewhere on the Platform, and whether these Terms should cross-reference it directly as a Seller obligation.
- Confirmation that MOVA's two-invoice structure does not constitute money transmission requiring licensure in any U.S. state.
- Whether the click-to-accept acceptance flow satisfies the U.S. ESIGN Act and UETA requirements for a valid electronic signature.
- Whether a force majeure clause is needed to address shipping, customs, or port delays outside any party's control.
- Whether Nigeria's NDPR, Ghana's Data Protection Act, or similar law in Togo or Benin requires disclosures beyond what is in MOVA's Privacy Policy.
- Any additional cross-border consumer-protection disclosures required for buyers in Nigeria, Ghana, Togo, or Benin.
`;
