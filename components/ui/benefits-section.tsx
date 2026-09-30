import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Benefit = {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  body: string;
};

/**
 * "Why ShipMova" block used on every audience page: headline, one-line
 * subhead, 4–6 icon cards, then whatever comes next (a table, a CTA).
 * Black/white site style; one column on phones, two or three on wider
 * screens.
 */
export function BenefitsSection({
  id,
  headline,
  subhead,
  benefits,
  children,
  className,
}: {
  id?: string;
  /** Omit both when the page's own header already carries them. */
  headline?: string;
  subhead?: string;
  benefits: Benefit[];
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("border-t border-gray-200 bg-white", className)}>
      <div className="mx-auto max-w-6xl px-6 py-16">
        {headline ? <h2 className="text-3xl font-semibold text-black">{headline}</h2> : null}
        {subhead ? <p className="mt-3 max-w-2xl text-gray-500">{subhead}</p> : null}
        <ul className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3", headline || subhead ? "mt-8" : "")}>
          {benefits.map((b) => (
            <li key={b.title} className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white">
                <b.icon className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="mt-3 font-semibold text-black">{b.title}</h3>
              <p className="mt-1 text-sm text-gray-500">{b.body}</p>
            </li>
          ))}
        </ul>
        {children}
      </div>
    </section>
  );
}
