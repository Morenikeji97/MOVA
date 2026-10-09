/** "Insured ✓ — marine cargo cover up to $X, valid to D Mon YYYY" (lib/shipper-verification.ts). */
export function InsuredBadge({ text }: { text: string | null }) {
  if (!text) return null;
  return <p className="mt-1 text-sm text-verified-600">{text}</p>;
}
