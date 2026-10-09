/** "Inspected at pickup ✓ — …" or the inspection's progress (0063 inspection_summary). */
export function InspectionBadge({ summary }: { summary: string | null }) {
  if (!summary) return null;
  const passed = summary.startsWith("Inspected at pickup ✓");
  const failed = summary.startsWith("Inspection at pickup failed");
  return (
    <p className={`mt-2 text-sm ${passed ? "font-medium text-verified-600" : failed ? "text-copper-700" : "text-gray-500"}`}>
      {summary}
    </p>
  );
}
