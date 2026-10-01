import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdminMfa } from "@/lib/admin-mfa";
import { AuthenticatorList } from "./authenticator-list";

export const metadata: Metadata = {
  title: "Two-step sign-in — ShipMova admin",
};

export const dynamic = "force-dynamic";

/**
 * The admin's authenticator apps: add a backup, remove a lost one.
 * Lost-phone recovery without a backup: docs/admin-mfa-recovery.md.
 */
export default async function AdminSecurityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const justEnrolled = sp.new === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") notFound();
  await requireAdminMfa(supabase);

  const authenticators = (user.factors ?? [])
    .filter((f) => f.factor_type === "totp" && f.status === "verified")
    .map((f) => ({ id: f.id, name: f.friendly_name ?? "Authenticator", createdAt: f.created_at }));

  return (
    <main className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold text-black">Two-step sign-in</h1>
      <p className="mt-2 text-gray-500">
        Signing in to this admin account needs your password and a code from one of these
        authenticator apps.
      </p>
      <AuthenticatorList
        authenticators={authenticators}
        promptBackup={justEnrolled && authenticators.length < 2}
      />
    </main>
  );
}
