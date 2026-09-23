import type { VerificationStatus } from "@/types/database";

export function overallBuyerVerificationStatus(
  nin: VerificationStatus,
  bvn: VerificationStatus,
): VerificationStatus {
  if (nin === "verified" || bvn === "verified") return "verified";
  if (nin === "failed" && bvn === "failed") return "failed";
  return "unverified";
}

export function isValidNinOrBvn(value: string): boolean {
  return /^\d{11}$/.test(value);
}
