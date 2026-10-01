"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type Pending = { factorId: string; qrCode: string; secret: string; uri: string };

/**
 * Adds one authenticator app (TOTP factor) to the signed-in account: shows
 * the QR code / setup key, then confirms with the app's first 6-digit code.
 * Verifying also raises the session to aal2. See lib/admin-mfa.ts.
 */
export function TotpEnroll({
  friendlyName,
  onVerified,
}: {
  /** Base label; " 2", " 3"… is appended if the account already has it. */
  friendlyName: string;
  onVerified: () => void;
}) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    // Once only — a second enroll() (e.g. a dev-mode double effect) would
    // leave an orphaned, unverified factor behind.
    if (started.current) return;
    started.current = true;

    (async () => {
      const supabase = createClient();
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError || !factors) {
        setError("Couldn't start set-up. Reload the page to try again.");
        return;
      }
      // Clear set-ups that were started but never confirmed, so retries
      // don't pile up and their names are free again.
      for (const f of factors.all) {
        if (f.factor_type === "totp" && f.status === "unverified") {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }
      const taken = new Set(
        factors.all.filter((f) => f.status === "verified").map((f) => f.friendly_name),
      );
      let name = friendlyName;
      for (let n = 2; taken.has(name); n++) name = `${friendlyName} ${n}`;

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: name,
        issuer: "ShipMova",
      });
      if (enrollError || !data) {
        setError("Couldn't start set-up. Reload the page to try again.");
        return;
      }
      setPending({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      });
    })();
  }, [friendlyName]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!pending) return;
    setError(null);
    setVerifying(true);
    const { error: verifyError } = await createClient().auth.mfa.challengeAndVerify({
      factorId: pending.factorId,
      code: code.trim(),
    });
    if (verifyError) {
      setError("That code didn't work. Codes change every 30 seconds — enter the one showing now.");
      setVerifying(false);
      return;
    }
    onVerified();
  }

  if (!pending) {
    return error ? (
      <p className="text-sm text-copper-700">{error}</p>
    ) : (
      <p className="text-sm text-gray-500">Preparing set-up…</p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-col gap-4 text-sm text-gray-700">
        <li>
          <span className="font-medium text-black">1. Add ShipMova to your authenticator app.</span>{" "}
          On this phone, tap the button. On another device, scan the QR code.
          <a
            href={pending.uri}
            className="mt-3 flex h-11 items-center justify-center rounded border border-black px-5 text-base font-medium text-black"
          >
            Add to authenticator app
          </a>
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: URI SVG from Supabase */}
          <img
            src={pending.qrCode}
            alt="QR code for your authenticator app"
            width={176}
            height={176}
            className="mx-auto mt-4 h-44 w-44 rounded border border-gray-200 bg-white p-2"
          />
          <p className="mt-3 text-gray-500">Or enter this setup key by hand:</p>
          <p className="mt-1 select-all break-all rounded bg-gray-100 px-3 py-2 font-mono text-sm text-black">
            {pending.secret}
          </p>
        </li>
        <li>
          <span className="font-medium text-black">2. Enter the 6-digit code it shows.</span>
        </li>
      </ol>
      <form onSubmit={handleVerify} className="flex flex-col gap-3">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          aria-label="6-digit code"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="h-11 rounded border border-gray-200 px-3 text-center font-mono text-base tracking-widest"
        />
        {error && <p className="text-sm text-copper-700">{error}</p>}
        <Button type="submit" disabled={verifying || code.length !== 6}>
          {verifying ? "Checking…" : "Confirm"}
        </Button>
      </form>
    </div>
  );
}
