import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

/** Every unknown URL, and every notFound() (e.g. a listing that isn't public). */
export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center bg-band px-4 py-16">
      <div className="mx-auto w-full max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Error 404</p>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          We can&rsquo;t find that page
        </h1>
        <p className="mt-3 text-muted">
          The link may be old, or the car may no longer be listed.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/browse" className={buttonClasses()}>
            Browse cars
          </Link>
          <Link href="/" className={buttonClasses({ variant: "secondary" })}>
            Go to the homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
