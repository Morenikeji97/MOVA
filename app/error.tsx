"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonClasses } from "@/components/ui/button";

/**
 * Shown when a page throws. Keeps the shared header and footer (it renders
 * inside the root layout); "Try again" re-renders the page.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] items-center bg-band px-4 py-16">
      <div className="mx-auto w-full max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Something went wrong</p>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          This page didn&rsquo;t load
        </h1>
        <p className="mt-3 text-muted">
          Please try again. If it keeps happening, message us on WhatsApp.
        </p>
        {error.digest ? (
          <p className="mt-2 text-xs text-muted">Reference: {error.digest}</p>
        ) : null}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button type="button" onClick={reset}>
            Try again
          </Button>
          <Link href="/" className={buttonClasses({ variant: "secondary" })}>
            Go to the homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
