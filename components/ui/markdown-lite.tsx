/** Inline "**bold**" spans within a line — the only inline markup these documents use. */
function renderInline(text: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-ink">
        {part}
      </strong>
    ) : (
      part
    )
  );
}

/**
 * Minimal markdown renderer for static legal/policy content — "# "/"## "
 * headings, blank-line-separated paragraphs (including a leading "_..._"
 * italic line), "- " bullet lists, "1. " numbered lists, and inline
 * "**bold**" spans. Intentionally not a general markdown parser; if content
 * needs more (links, tables), this should grow to match rather than pulling
 * in a full markdown dependency for a handful of static pages.
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
            <h2 key={i} className="mt-10 font-display text-xl font-bold text-ink">
              {lines[0].slice(3)}
            </h2>
          );
        }
        if (lines[0].startsWith("# ")) {
          return (
            <h1 key={i} className="font-display text-3xl font-extrabold tracking-tight text-ink">
              {lines[0].slice(2)}
            </h1>
          );
        }
        if (
          lines.length === 1 &&
          // Single-asterisk/underscore only — a standalone "**bold**" line
          // (e.g. "**ShipMova is not:**") also starts and ends with "*" and must
          // fall through to the bold-paragraph case below, not render here
          // with one layer of asterisk stripped off and the other left in.
          ((lines[0].startsWith("_") && lines[0].endsWith("_") && !lines[0].startsWith("__")) ||
            (lines[0].startsWith("*") &&
              lines[0].endsWith("*") &&
              !lines[0].startsWith("**") &&
              !lines[0].endsWith("**")))
        ) {
          return (
            <p key={i} className="mt-2 text-sm italic text-muted">
              {lines[0].slice(1, -1)}
            </p>
          );
        }
        if (lines.every((l) => l.startsWith("- "))) {
          return (
            <ul key={i} className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted sm:text-[15px]">
              {lines.map((l, j) => (
                <li key={j}>{renderInline(l.slice(2))}</li>
              ))}
            </ul>
          );
        }
        if (lines.every((l) => /^\d+\.\s/.test(l))) {
          return (
            <ol key={i} className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted sm:text-[15px]">
              {lines.map((l, j) => (
                <li key={j}>{renderInline(l.replace(/^\d+\.\s*/, ""))}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i} className="mt-3 text-sm leading-relaxed text-muted sm:text-[15px]">
            {renderInline(lines.join(" "))}
          </p>
        );
      })}
    </>
  );
}
