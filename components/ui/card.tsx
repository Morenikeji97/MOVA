import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared class list for cards (design system, redesign PR A): white, 14px
 * radius, soft shadow, hairline border so it still reads on a white page.
 * Exported so a <Link> or <li> can look like a card without nesting.
 */
export function cardClasses({ padded = true, className }: { padded?: boolean; className?: string } = {}) {
  return cn("rounded-card border border-line bg-white shadow-card", padded && "p-5", className);
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cardClasses({ className })} {...props} />;
}
