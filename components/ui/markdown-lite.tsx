/**
 * Minimal markdown renderer for static legal/policy content — "# "/"## "
 * headings, blank-line-separated paragraphs (including a leading "_..._"
 * italic line), and "- " bullet lists. Intentionally not a general markdown
 * parser; if content needs more (numbered lists, bold, links, tables), this
 * should grow to match rather than pulling in a full markdown dependency for
 * one static page.
 */
export function MarkdownLite({ source }: { source: string }) {
  const blocks = source.trim().split(/\n\s*\n/);

  return (
    <>
      {blocks.map((block, i) => {
        const lines = block
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        if (lines.length === 0) return null;

        if (lines[0].startsWith("## ")) {
          return (
            <h2 key={i} className="mt-8 text-lg font-semibold text-ink-900">
              {lines[0].slice(3)}
            </h2>
          );
        }
        if (lines[0].startsWith("# ")) {
          return (
            <h1 key={i} className="text-2xl font-semibold text-ink-900">
              {lines[0].slice(2)}
            </h1>
          );
        }
        if (
          lines.length === 1 &&
          ((lines[0].startsWith("_") && lines[0].endsWith("_")) ||
            (lines[0].startsWith("*") && lines[0].endsWith("*")))
        ) {
          return (
            <p key={i} className="mt-2 text-sm italic text-ink-400">
              {lines[0].slice(1, -1)}
            </p>
          );
        }
        if (lines.every((l) => l.startsWith("- "))) {
          return (
            <ul key={i} className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-500">
              {lines.map((l, j) => (
                <li key={j}>{l.slice(2)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="mt-3 text-sm text-slate-500">
            {lines.join(" ")}
          </p>
        );
      })}
    </>
  );
}
