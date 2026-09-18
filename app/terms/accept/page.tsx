import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MarkdownLite } from "@/components/ui/markdown-lite";
import { AcceptTermsForm } from "@/components/ui/accept-terms-form";
import { TERMS_AND_CONDITIONS_MARKDOWN } from "@/lib/terms-content";
import { CURRENT_TERMS_VERSION, TERMS_EFFECTIVE_DATE } from "@/lib/terms";

export const metadata: Metadata = {
  title: "Terms & Conditions — MOVA",
  description: "Review and accept MOVA's Terms & Conditions to continue.",
};

export const dynamic = "force-dynamic";

function safeNext(next: string | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}

export default async function AcceptTermsPage({
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

  // Already accepted the current version (e.g. a direct visit after already
  // clicking through) — nothing to do here.
  const { data: acceptance } = await supabase
    .from("terms_acceptances")
    .select("id")
    .eq("user_id", user.id)
    .eq("version", CURRENT_TERMS_VERSION)
    .maybeSingle();
  if (acceptance) {
    redirect(next);
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-wider text-gray-500">
        Effective {TERMS_EFFECTIVE_DATE} &middot; Version {CURRENT_TERMS_VERSION}
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-black">
        Please review and accept our Terms &amp; Conditions
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        You must accept the current Terms &amp; Conditions to continue using
        MOVA.
      </p>

      <article className="mt-8 max-h-[28rem] overflow-y-auto rounded-lg border border-gray-200 bg-white p-6">
        <MarkdownLite source={TERMS_AND_CONDITIONS_MARKDOWN} />
      </article>

      <AcceptTermsForm next={next} />
    </main>
  );
}
