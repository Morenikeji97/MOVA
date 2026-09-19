import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MarkdownLite } from "@/components/ui/markdown-lite";
import { AcceptPoliciesForm } from "@/components/ui/accept-policies-form";
import { TERMS_AND_CONDITIONS_MARKDOWN } from "@/lib/terms-content";
import { PRIVACY_POLICY_MARKDOWN } from "@/lib/privacy-content";
import { CURRENT_TERMS_VERSION, TERMS_EFFECTIVE_DATE } from "@/lib/terms";
import { CURRENT_PRIVACY_VERSION, PRIVACY_EFFECTIVE_DATE } from "@/lib/privacy";

export const metadata: Metadata = {
  title: "Terms & Privacy — MOVA",
  description: "Review and accept MOVA's Terms & Conditions and Privacy Policy to continue.",
};

export const dynamic = "force-dynamic";

function safeNext(next: string | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}

export default async function AcceptPoliciesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawNext = typeof sp.next === "string" ? sp.next : undefined;
  const next = safeNext(rawNext);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/terms/accept");
  }

  // Independently checked — a user may be missing just one of the two (e.g.
  // they already accepted Terms before the Privacy Policy gate existed).
  const [{ data: termsAcceptance }, { data: privacyAcceptance }] = await Promise.all([
    supabase
      .from("terms_acceptances")
      .select("id")
      .eq("user_id", user.id)
      .eq("version", CURRENT_TERMS_VERSION)
      .maybeSingle(),
    supabase
      .from("privacy_policy_acceptances")
      .select("id")
      .eq("user_id", user.id)
      .eq("version", CURRENT_PRIVACY_VERSION)
      .maybeSingle(),
  ]);

  const needsTerms = !termsAcceptance;
  const needsPrivacy = !privacyAcceptance;

  // Already accepted both current versions (e.g. a direct visit after
  // already clicking through) — nothing to do here.
  if (!needsTerms && !needsPrivacy) {
    redirect(next);
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mt-2 text-2xl font-semibold text-black">
        Please review and accept our policies
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        You must accept the current Terms &amp; Conditions and Privacy Policy
        to continue using MOVA.
      </p>

      {needsTerms ? (
        <section className="mt-8">
          <p className="font-mono text-xs uppercase tracking-wider text-gray-500">
            Effective {TERMS_EFFECTIVE_DATE} &middot; Version {CURRENT_TERMS_VERSION}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-black">Terms &amp; Conditions</h2>
          <article className="mt-3 max-h-[24rem] overflow-y-auto rounded-lg border border-gray-200 bg-white p-6">
            <MarkdownLite source={TERMS_AND_CONDITIONS_MARKDOWN} />
          </article>
        </section>
      ) : (
        <p className="mt-8 rounded border border-verified-100 bg-verified-50 p-3 text-sm text-black">
          Terms &amp; Conditions — already accepted.
        </p>
      )}

      {needsPrivacy ? (
        <section className="mt-6">
          <p className="font-mono text-xs uppercase tracking-wider text-gray-500">
            Effective {PRIVACY_EFFECTIVE_DATE} &middot; Version {CURRENT_PRIVACY_VERSION}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-black">Privacy Policy</h2>
          <article className="mt-3 max-h-[24rem] overflow-y-auto rounded-lg border border-gray-200 bg-white p-6">
            <MarkdownLite source={PRIVACY_POLICY_MARKDOWN} />
          </article>
        </section>
      ) : (
        <p className="mt-6 rounded border border-verified-100 bg-verified-50 p-3 text-sm text-black">
          Privacy Policy — already accepted.
        </p>
      )}

      <AcceptPoliciesForm next={next} needsTerms={needsTerms} needsPrivacy={needsPrivacy} />
    </main>
  );
}
