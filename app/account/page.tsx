import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cardClasses } from "@/components/ui/card";
import { DashboardHeader, DashboardShell, Notice } from "@/components/ui/dashboard";
import { WHAT_IS_DELETED, WHAT_IS_KEPT } from "@/lib/account-deletion";
import { DeleteAccountForm } from "./delete-form";

export const metadata: Metadata = { title: "Your account — ShipMova", robots: { index: false } };
export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Account settings: who you're signed in as, and deleting your account (Privacy Policy §9). */
export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const { data: pending } = await supabase
    .from("account_deletion_requests")
    .select("requested_at")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  return (
    <DashboardShell narrow>
      <DashboardHeader eyebrow="Account" title="Your account" intro={`Signed in as ${user.email ?? ""}`} />

      <section className={cardClasses({ className: "mt-6" })}>
        <h2 className="font-display text-xl font-bold text-ink">Delete your account</h2>
        {pending ? (
          <Notice tone="info" className="mt-3">
            You asked to delete your account on {when.format(new Date(pending.requested_at))}. ShipMova will email you
            when it&rsquo;s done, usually within 3 days. To cancel, message us on WhatsApp.
          </Notice>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">This can&rsquo;t be undone.</p>
            <h3 className="mt-4 text-sm font-semibold text-ink">Deleted</h3>
            <ul className="mt-1 list-disc pl-5 text-sm text-muted">
              {WHAT_IS_DELETED.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <h3 className="mt-3 text-sm font-semibold text-ink">Kept, as our Privacy Policy explains</h3>
            <ul className="mt-1 list-disc pl-5 text-sm text-muted">
              {WHAT_IS_KEPT.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-muted">
              If you have a deal in progress, finish or cancel it first.
            </p>
            <DeleteAccountForm />
          </>
        )}
      </section>
    </DashboardShell>
  );
}
