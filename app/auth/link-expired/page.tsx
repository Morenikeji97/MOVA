import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { ResendConfirmation } from "./resend-confirmation";

export const metadata: Metadata = {
  title: "This link has expired — ShipMova",
};

/**
 * Where /auth/confirm sends an emailed link that's expired, already used or
 * malformed. Says so plainly and offers the right next step for the kind
 * of link it was.
 */
export default async function LinkExpiredPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; reason?: string }>;
}) {
  const { type } = await searchParams;
  const isReset = type === "recovery";
  const isSignup = type === "signup" || type === "email" || type === "invite";

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold text-black">This link has expired</h1>
      <p className="mt-2 text-gray-500">
        Links in ShipMova emails can only be used once and stop working after a
        while. {isReset ? "Request a new password-reset link below." : null}
        {isSignup ? "If you've already confirmed your email, just sign in." : null}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        {isReset ? (
          <Link href="/forgot-password" className={buttonClasses({ size: "md" })}>
            Send a new reset link
          </Link>
        ) : (
          <Link href="/login" className={buttonClasses({ size: "md" })}>
            Sign in
          </Link>
        )}
        <Link href="/" className={buttonClasses({ size: "md", variant: "secondary" })}>
          Back to ShipMova
        </Link>
      </div>

      {isSignup ? <ResendConfirmation className="mt-8" /> : null}
    </main>
  );
}
