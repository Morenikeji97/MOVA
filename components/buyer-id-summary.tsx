/**
 * What a seller sees about a buyer's ID check (migration 0058's
 * buyer_id_summary): e.g. "Nigerian NIN verified — name matches government
 * record". Never the ID number, the photo or the record itself.
 */
export function BuyerIdSummary({ summary }: { summary: string | null }) {
  if (!summary) return null;
  const verified = summary !== "ID not verified yet";
  return (
    <p className={`mt-2 text-sm ${verified ? "text-verified-600" : "text-gray-500"}`}>
      {verified ? "✓ " : ""}
      {summary}
    </p>
  );
}
