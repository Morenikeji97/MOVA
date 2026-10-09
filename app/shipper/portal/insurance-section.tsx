import type { CoiStatus, LicenseStatus } from "@/lib/shipper-verification";
import { daysUntil, formatDay, insuredBadge, isoDay } from "@/lib/shipper-verification";
import { InsuranceForm } from "./insurance-form";

/**
 * The shipper's verification status in their portal: insurance certificate
 * and FMC license. Buyers see the shipper only when both are done.
 */
export function InsuranceSection({
  userId,
  s,
}: {
  userId: string;
  s: {
    coi_status: CoiStatus;
    coi_expires_on: string | null;
    coi_cargo_limit_usd: number | null;
    coi_insurer: string | null;
    coi_review_note: string | null;
    license_status: LicenseStatus;
  };
}) {
  const today = isoDay(new Date());
  const badge = insuredBadge(s, today);
  const days = s.coi_expires_on ? daysUntil(s.coi_expires_on, today) : null;
  const expired = s.coi_status === "approved" && days !== null && days < 0;
  const expiringSoon = !!badge && days !== null && days <= 30;
  const showForm = s.coi_status !== "pending" && (!badge || expiringSoon);

  return (
    <section className="mt-6 rounded-card border border-line bg-white p-5 shadow-card">
      <h2 className="font-display text-xl font-bold text-ink">Verification</h2>
      <p className="mt-1 text-sm text-muted">
        Buyers only see shippers with in-date marine cargo insurance and an FMC/OTI license
        ShipMova has checked.
      </p>

      <div className="mt-4">
        <p className="font-semibold text-ink">Marine cargo insurance</p>
        {badge ? (
          <p className="mt-1 text-sm text-verified-600">
            {badge}
            {s.coi_insurer ? ` · ${s.coi_insurer}` : ""}
          </p>
        ) : expired ? (
          <p className="mt-1 text-sm text-copper-700">
            Your certificate expired on {formatDay(s.coi_expires_on!)}. You&rsquo;re hidden from
            buyers until you upload your new one.
          </p>
        ) : s.coi_status === "pending" ? (
          <p className="mt-1 text-sm text-marine-700">ShipMova is checking your certificate.</p>
        ) : s.coi_status === "rejected" ? (
          <p className="mt-1 text-sm text-copper-700">
            Your certificate wasn&rsquo;t accepted{s.coi_review_note ? `: ${s.coi_review_note}` : ""}. Please
            upload a new one.
          </p>
        ) : (
          <p className="mt-1 text-sm text-copper-700">
            Upload your certificate of marine cargo insurance.
          </p>
        )}
        {expiringSoon ? (
          <p className="mt-1 text-sm text-copper-700">
            It expires in {days} day{days === 1 ? "" : "s"} — upload your renewed certificate now so you
            stay visible.
          </p>
        ) : null}
        {showForm ? <InsuranceForm userId={userId} /> : null}
      </div>

      <div className="mt-6">
        <p className="font-semibold text-ink">FMC/OTI license</p>
        <p className={`mt-1 text-sm ${s.license_status === "active" ? "text-verified-600" : s.license_status === "not_found" ? "text-copper-700" : "text-muted"}`}>
          {s.license_status === "active"
            ? "✓ Checked on the FMC's OTI list."
            : s.license_status === "not_found"
              ? "ShipMova couldn't find your license on the FMC's OTI list. Reply to our email or contact ShipMova."
              : "ShipMova will check your license on the FMC's OTI list."}
        </p>
      </div>
    </section>
  );
}
