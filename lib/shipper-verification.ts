/**
 * ShipMova — shipper verification gate (migration 0060). A shipper is shown
 * to buyers and bookable only when approved, not suspended, with an approved
 * marine-cargo insurance certificate (COI) that hasn't expired, and an
 * FMC/OTI license an admin has checked on the FMC's OTI list. The database
 * enforces the same rule (public.shipper_is_bookable); this file is the app's
 * copy for labels and reminders. No imports, so node tests can use it.
 */

export type CoiStatus = "none" | "pending" | "approved" | "rejected";
export type LicenseStatus = "unchecked" | "active" | "not_found";
export type CoiReminderStage = "30d" | "7d" | "expired";

export const SHIPPER_INSURANCE_BUCKET = "shipper-insurance-documents";

/**
 * The FMC publishes its OTI list as a website only (no API): an admin opens
 * it, searches the license number, and records the result in ShipMova.
 */
export const FMC_OTI_LIST_URL = "https://www2.fmc.gov/oti/";
export const FMC_OTI_SEARCH_URLS = [
  { label: "NVOCC list", href: "https://www2.fmc.gov/oti/NVOCC.aspx" },
  { label: "Freight forwarder list", href: "https://www2.fmc.gov/oti/FF.aspx" },
] as const;

type Dated = string | null | undefined;

/** "YYYY-MM-DD" for a Date, in UTC (the database's current_date is UTC). */
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Whole days from today to the expiry date (negative once expired). */
export function daysUntil(expiresOn: string, today: string): number {
  return Math.round((Date.parse(`${expiresOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

export function isInsured(s: { coi_status: CoiStatus; coi_expires_on: Dated }, today: string): boolean {
  return s.coi_status === "approved" && !!s.coi_expires_on && s.coi_expires_on >= today;
}

export function isBookable(
  s: {
    status: string;
    payment_status: string;
    coi_status: CoiStatus;
    coi_expires_on: Dated;
    license_status: LicenseStatus;
  },
  today: string,
): boolean {
  return (
    s.status === "approved" &&
    s.payment_status !== "suspended" &&
    isInsured(s, today) &&
    s.license_status === "active"
  );
}

/**
 * Which reminder is due for an approved certificate, given the last one
 * sent: 30 days before, 7 days before, and on expiry — each once.
 */
export function dueReminder(
  expiresOn: string,
  today: string,
  lastSent: CoiReminderStage | null,
): CoiReminderStage | null {
  const days = daysUntil(expiresOn, today);
  const order: CoiReminderStage[] = ["30d", "7d", "expired"];
  const due: CoiReminderStage | null = days < 0 ? "expired" : days <= 7 ? "7d" : days <= 30 ? "30d" : null;
  if (!due) return null;
  if (lastSent && order.indexOf(lastSent) >= order.indexOf(due)) return null;
  return due;
}

/**
 * FMC license / registration numbers are digits with an optional letter
 * suffix (e.g. 023456N, 019876F, 025123NF). Normalised, or null when the
 * shape is wrong — a hint for the admin, not proof of a license.
 */
export function cleanFmcLicense(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.toUpperCase().replace(/[\s#.-]+/g, "").replace(/^(FMC|OTI)/, "");
  return /^\d{3,6}[A-Z]{0,2}$/.test(v) ? v : null;
}

const longDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** The "Insured ✓" badge line buyers see, or null when not insured. */
export function insuredBadge(
  s: { coi_status: CoiStatus; coi_expires_on: Dated; coi_cargo_limit_usd: number | string | null },
  today: string,
): string | null {
  if (!isInsured(s, today)) return null;
  const limit = s.coi_cargo_limit_usd != null ? ` up to ${usd.format(Number(s.coi_cargo_limit_usd))}` : "";
  return `Insured ✓ — marine cargo cover${limit}, valid to ${longDate.format(new Date(`${s.coi_expires_on}T00:00:00Z`))}`;
}

export function formatDay(day: string): string {
  return longDate.format(new Date(`${day}T00:00:00Z`));
}
