import Link from "next/link";
import { MarkdownLite } from "@/components/ui/markdown-lite";

/** The three public legal pages under /policies share this layout. */
export function PolicyPage({ source, note }: { source: string; note?: string }) {
  return (
    <main className="min-h-screen bg-band">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Link href="/" className="flex h-11 w-fit items-center text-sm font-semibold text-muted hover:text-ink">
          &larr; ShipMova
        </Link>
        {note ? (
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{note}</p>
        ) : null}
        <article className="mt-4 rounded-card border border-line bg-white p-5 shadow-card sm:p-10">
          <MarkdownLite source={source} />
        </article>
      </div>
    </main>
  );
}
