"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { TotpEnroll } from "@/components/ui/totp-enroll";

type Authenticator = { id: string; name: string; createdAt: string };

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export function AuthenticatorList({
  authenticators,
  promptBackup,
}: {
  authenticators: Authenticator[];
  promptBackup: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onlyOne = authenticators.length < 2;

  async function remove(a: Authenticator) {
    if (!window.confirm(`Remove "${a.name}"? Its codes will stop working for ShipMova.`)) return;
    setError(null);
    setRemovingId(a.id);
    const supabase = createClient();
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: a.id });
    if (unenrollError) {
      setError("Couldn't remove it. Reload the page and try again.");
      setRemovingId(null);
      return;
    }
    await supabase.auth.refreshSession();
    setRemovingId(null);
    router.refresh();
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      {promptBackup && !adding && (
        <div className="rounded-lg border border-ink bg-white p-4">
          <p className="font-medium text-ink">Two-step sign-in is on.</p>
          <p className="mt-1 text-sm text-ink">
            Add a backup authenticator now — a second app or device. If you lose this phone,
            it&rsquo;s how you get back in.
          </p>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {authenticators.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between gap-3 rounded-card border border-line bg-white shadow-card p-4"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">{a.name}</p>
              <p className="text-sm text-muted">Added {dateFormat.format(new Date(a.createdAt))}</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => remove(a)}
              disabled={onlyOne || removingId !== null}
              title={onlyOne ? "Add another authenticator before removing this one." : undefined}
            >
              {removingId === a.id ? "Removing…" : "Remove"}
            </Button>
          </li>
        ))}
      </ul>
      {onlyOne && (
        <p className="text-sm text-muted">
          To replace your only authenticator, add the new one first, then remove the old one.
        </p>
      )}
      {error && <p className="text-sm text-copper-700">{error}</p>}

      {adding ? (
        <div className="rounded-card border border-line bg-white shadow-card p-4">
          <h2 className="mb-4 font-semibold text-ink">Add a backup authenticator</h2>
          <TotpEnroll
            friendlyName="Backup authenticator"
            onVerified={() => {
              setAdding(false);
              router.replace("/admin/security");
              router.refresh();
            }}
          />
        </div>
      ) : (
        <Button type="button" onClick={() => setAdding(true)}>
          {authenticators.length < 2 ? "Add a backup authenticator" : "Add another authenticator"}
        </Button>
      )}

      <Link href="/admin/dashboard" className="text-sm text-ink underline">
        Back to the admin dashboard
      </Link>
    </div>
  );
}
