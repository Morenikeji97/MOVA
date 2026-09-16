import type { DisputeCategory, DisputeStatus } from "@/types/database";

export const DISPUTE_CATEGORIES: DisputeCategory[] = [
  "seller_unresponsive",
  "vehicle_misrepresented",
  "shipping_issue",
  "other",
];

export const DISPUTE_CATEGORY_LABEL: Record<DisputeCategory, string> = {
  seller_unresponsive: "Seller unresponsive",
  vehicle_misrepresented: "Vehicle misrepresented",
  shipping_issue: "Shipping issue",
  other: "Other",
};

export const DISPUTE_STATUS_LABEL: Record<DisputeStatus, string> = {
  open: "Open — awaiting MOVA review",
  approved_pending_refund: "Approved — refund pending",
  denied: "Denied",
  refund_completed: "Refund completed",
};

/** Evidence upload constraints — mirrors the dispute-evidence bucket (0015). */
export const DISPUTE_EVIDENCE_BUCKET = "dispute-evidence";
export const DISPUTE_EVIDENCE_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;
export const DISPUTE_EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
export const DISPUTE_EVIDENCE_MAX_FILES = 5;
export const DISPUTE_EVIDENCE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
