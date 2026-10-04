import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export default async function ShipperSignupSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const emailFailed = (await searchParams).email === "failed";
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold text-black">Application received</h1>
      {emailFailed ? (
        <p className="mt-3 rounded border border-copper-100 bg-copper-50 p-3 text-sm text-copper-700">
          Your application is saved, but we couldn&rsquo;t send the confirmation
          email. No need to apply again — ShipMova will contact you at the email you
          gave once it&rsquo;s reviewed.
        </p>
      ) : (
        <p className="mt-3 text-sm text-gray-500">
          We&rsquo;ve emailed you a confirmation. Check spam or promotions if you
          don&rsquo;t see it.
        </p>
      )}
      <p className="mt-3 text-gray-500">
        Thanks — your shipper application is with the ShipMova team for review.
        We&rsquo;ll be in touch by email once it&rsquo;s approved, and your rates
        will then be visible to buyers.
      </p>
      <p className="mt-2 text-sm text-gray-500">
        No fees for founding partners: ShipMova charges you nothing.
      </p>
      <p className="mt-2 text-sm text-gray-500">
        Once approved, create a ShipMova login with this same email (or sign in) and
        go to the <strong>shipper portal</strong> to add and manage your rates.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/shipper/portal" className={buttonClasses({})}>
          Go to shipper portal
        </Link>
        <Link
          href="/"
          className={buttonClasses({ variant: "secondary" })}
        >
          Back to ShipMova
        </Link>
      </div>
    </main>
  );
}
