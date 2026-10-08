import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Sign in, sign up, password reset and Verify your ID: one white card on the
 * light-grey band, under the shared header. Full width (16px gutters) on
 * phones.
 */
export function AuthShell({
  children,
  center = false,
  wide = false,
}: {
  children: ReactNode;
  /** Centered text, for the short "check your email" style screens. */
  center?: boolean;
  /** Room for a longer form (Verify your ID). */
  wide?: boolean;
}) {
  return (
    <main className="min-h-[70vh] bg-band px-4 py-10 sm:py-16">
      <div
        className={cn(
          "mx-auto flex flex-col rounded-card border border-line bg-white p-5 shadow-card sm:p-8",
          wide ? "max-w-xl" : "max-w-md",
          center && "items-center text-center",
        )}
      >
        {children}
      </div>
    </main>
  );
}
