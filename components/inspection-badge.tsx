/** "Inspected at pickup ✓ — …" or the inspection's progress (0063 inspection_summary). */
export function InspectionBadge({ summary }: { summary: string | null }) {
  if (!summary) return null;
  const passed = summary.startsWith("Inspected at pickup ✓");
  const failed = summary.startsWith("Inspection at pickup failed");
  return (
    <p
      className={`mt-3 rounded-lg border p-3 text-sm ${
        passed
          ? "border-verified-600/20 bg-verified-50 font-semibold text-verified-600"
          : failed
            ? "border-copper-100 bg-copper-50 text-copper-700"
            : "border-line bg-white text-muted"
      }`}
    >
      {summary}
    </p>
  );
}
