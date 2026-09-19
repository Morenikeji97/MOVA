/**
 * Raw markdown source for the Privacy Policy, rendered by /terms/accept via
 * the minimal parser in components/ui/markdown-lite.tsx (headings,
 * paragraphs, "*.../_..._" italic lines, "- " bullet lists, "1. " numbered
 * lists, and inline "**bold**" spans).
 *
 * Version v1.0, effective 2026-09-18 — matches CURRENT_PRIVACY_VERSION in
 * lib/privacy.ts. Bump that constant (not this file's own text) whenever
 * this content changes in a way that requires re-acceptance; see
 * lib/terms.ts's doc comment for the mechanism this mirrors exactly.
 *
 * Section 15 ("Legal Notice") is this document's own attorney-review flag —
 * it lists open legal questions still pending review, not a placeholder for
 * this feature's plumbing.
 */
export const PRIVACY_POLICY_MARKDOWN = `
# MOVA Privacy Policy

*Last updated: 2026-09-18*

## 1. Overview & Scope

This Privacy Policy explains how MOVA ("MOVA," "we," "us," or "our") collects, uses, shares, and protects information when you use the MOVA platform, including shipmova.com and any related applications (the "Platform").

This Policy applies to all users of the Platform — Buyers, Sellers, and Shippers — regardless of where they access the Platform from, including Nigeria, Ghana, Togo, Benin, and the United States. It is incorporated by reference into MOVA's Terms & Conditions, and creating an account requires accepting both.

MOVA is a technology platform that facilitates introductions between vehicle Buyers, Sellers, and Shippers; it does not process vehicle sale payments and is not a bank, KYC provider, or credit bureau. Some of the information described below is collected directly by MOVA, and some is collected by third-party providers MOVA relies on (see Sections 4 and 5).

## 2. Information We Collect

**Information you provide directly:**

- Account information: name, email address, phone number, password, account type (Buyer, Seller, or Shipper)
- Profile information: business name and physical service areas (Shippers), shipping rates and vehicle-size categories (Shippers), payout details (Sellers)
- Listing content: vehicle photos, video, VIN, mileage, price, and description (Sellers)
- Messages sent through Platform chat
- Reviews and ratings you submit
- Identity verification documents and information you submit for KYC checks (see Section 4)
- Support requests and any information you provide when contacting MOVA

**Information collected automatically:**

- Device and usage information: IP address, browser type, pages visited, timestamps
- Cookies and similar tracking technologies (see Section 10)
- Records of policy acceptances (Terms & Conditions, Buyer Protection & Refund Policy, this Privacy Policy), including the date, time, IP address, and version accepted

**Information from third parties:**

- Identity verification status from KYC providers (see Section 4)
- Payment and identity-verification data from Stripe (see Section 5)
- Information you make available if you sign in through a third-party account provider, where offered

## 3. How We Use Information

MOVA uses the information it collects to:

- Create and manage your account, and verify your identity and eligibility to use the Platform
- Operate core Platform features: listings, search, messaging, reviews, and the Buyer–Seller–Shipper introduction and fee process
- Match Shippers to vehicle listings by service area, so Buyers see relevant, typically lower-cost shipping options for a given vehicle's location (see Section 6)
- Process MOVA's own facilitation fee through our payment processor
- Detect and prevent fraud, prohibited off-Platform circumvention, and violations of MOVA's Terms & Conditions
- Comply with legal obligations, including sanctions and export-control screening
- Send transactional communications (payment confirmations, listing status, dispute updates) and, where you have not opted out, product updates
- Improve and troubleshoot the Platform

## 4. Identity Verification & Third-Party KYC Providers

MOVA uses third-party identity verification providers to confirm that Sellers, Buyers, and Shippers are who they say they are:

- **Stripe Identity** for Seller (and, where applicable, Shipper) identity checks
- **Dojah, Youverify, or Prembly** for Buyer NIN/BVN checks in supported countries

These providers receive the identity documents or numbers you submit directly for verification. **MOVA does not store raw national ID numbers, bank verification numbers, or government ID images** — MOVA stores only the verification status (such as "verified" or "not verified") returned by these providers. Each provider processes your information under its own privacy policy and terms, which govern how they handle the data you submit to them.

A "VIN Verified" badge or a completed identity check reflects the outcome of these checks at the time performed; see MOVA's Terms & Conditions Section 9 for the limits of what verification does and does not guarantee.

## 5. Payment Processing

MOVA's own facilitation fee is processed through **Stripe**, or, where enabled, via bank transfer with manually reviewed proof of payment. When you pay through Stripe, Stripe collects and processes your payment card or bank details directly — MOVA does not receive or store your full card number or bank account credentials.

Payment for the vehicle itself (between Buyer and Seller) and payment for shipping (between Buyer and Shipper) happen directly between those users, outside the Platform. MOVA is not a party to those payments and does not collect or process that payment information.

## 6. How We Share Information

MOVA shares information in the following circumstances:

- **Between matched users:** once MOVA's facilitation fee is paid, a Seller's contact information is released to the Buyer. A Shipper's business profile, published service areas, and rates are visible to Buyers evaluating shipping options, and are automatically surfaced first for listings located within a Shipper's declared service area, since a nearby Shipper is typically able to offer a lower rate.
- **With service providers:** identity verification providers (Section 4), Stripe for payments, Resend for transactional email, and Supabase for database and file storage — each acting on MOVA's behalf to operate the Platform.
- **For legal and safety reasons:** where required by law, to comply with sanctions or export-control obligations, to investigate suspected fraud or a Terms & Conditions violation, or to protect the rights, property, or safety of MOVA, its users, or the public.
- **Business transfers:** if MOVA is involved in a merger, acquisition, or asset sale, user information may be transferred as part of that transaction, subject to this Policy or a successor policy.

MOVA does not sell your personal information to third parties for their own marketing purposes.

## 7. International Data Transfers

MOVA is based in the United States, and information collected through the Platform is generally stored and processed in the United States by MOVA's infrastructure providers. If you access the Platform from Nigeria, Ghana, Togo, Benin, or elsewhere outside the United States, your information will be transferred to, stored, and processed in the United States, where privacy laws may differ from those of your country.

By using the Platform, you consent to this transfer, storage, and processing. MOVA takes steps to protect information consistent with this Policy regardless of where it is processed.

## 8. Data Retention

MOVA retains account and transaction information for as long as your account is active, and for a period afterward as needed to resolve disputes, enforce MOVA's Terms & Conditions, comply with legal and tax obligations, and maintain accurate business records. Policy acceptance records (Section 2) are retained for as long as the associated account exists, consistent with their role as compliance records.

MOVA does not itself retain raw KYC identifiers (Section 4); retention of those is governed by the applicable third-party provider's own policy. When information is no longer needed for these purposes, MOVA will delete or anonymize it, except where retention is required by law.

## 9. Your Rights & Choices

Depending on where you live, you may have rights to access, correct, or request deletion of your personal information, or to object to or restrict certain processing. You can:

- Review and update most account information directly from your account settings
- Request a copy of the personal information MOVA holds about you
- Request deletion of your account and associated personal information, subject to MOVA's retention obligations under Section 8 (for example, transaction and policy-acceptance records tied to a completed sale)
- Opt out of non-essential marketing email using the unsubscribe link in that email; you cannot opt out of essential transactional messages (payment confirmations, security notices, legal notices) while your account remains active

To exercise any of these rights, contact privacy@shipmova.com. MOVA will respond within a reasonable time and may need to verify your identity before acting on a request.

## 10. Cookies & Tracking Technologies

MOVA uses cookies and similar technologies to keep you signed in, remember your preferences, and understand how the Platform is used so it can be improved. MOVA does not currently use third-party advertising cookies. You can control cookies through your browser settings, though disabling essential cookies may prevent parts of the Platform (such as staying signed in) from working correctly.

## 11. Data Security

MOVA uses reasonable administrative, technical, and physical safeguards designed to protect your information, including encryption in transit, database-level access controls (row-level security restricting each user to their own data), and restricted access to identity-verification results. No method of transmission or storage is completely secure, and MOVA cannot guarantee absolute security. Notify MOVA immediately at support@shipmova.com if you suspect unauthorized access to your account.

## 12. Children's Privacy

The Platform is not directed to, and may not be used by, anyone under 18. MOVA does not knowingly collect personal information from anyone under 18. If MOVA learns that it has collected personal information from someone under 18, it will delete that information promptly.

## 13. Changes to This Policy

MOVA may update this Privacy Policy from time to time. Material changes will be reflected by an updated "Last updated" date, and, where required, MOVA will request renewed acceptance from active accounts, consistent with the Terms & Conditions acceptance process. Continued use of the Platform after a change takes effect constitutes acceptance of the revised Policy.

## 14. Contact Us

Questions, requests, or concerns about this Privacy Policy or your personal information can be sent to privacy@shipmova.com.

## 15. Legal Notice

*Draft — pending New York attorney review. This document has not been reviewed by a licensed attorney and should not be treated as final. The following should be confirmed before this document is relied on as MOVA's final Privacy Policy:*

- Whether Nigeria's NDPR, Ghana's Data Protection Act, or similar law in Togo or Benin requires disclosures, consent mechanisms, or a local representative beyond what is reflected here.
- Whether a formal Data Processing Agreement is needed with Stripe, Resend, Supabase, or the KYC providers (Dojah, Youverify, Prembly).
- Whether the international-transfer language in Section 7 needs a more specific legal mechanism for any destination country that requires one.
- Confirmation of the correct retention periods in Section 8 once transaction-dispute and tax-recordkeeping timelines are finalized with counsel and an accountant.
- Whether any U.S. state-specific privacy law (e.g., California) applies to MOVA's current user base and requires additional disclosures.
`;
