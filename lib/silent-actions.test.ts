import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Every server action must report back (lib/action-result.ts): "Saved…" only
// after the write is confirmed, or "Not saved: <reason>". An action that
// returns nothing can fail silently, which is how an escrow save looked
// saved on 2026-10-04 while nothing reached the database.
//
// Allowed exceptions, each reviewed:
const ALLOWED_VOID = new Map([
  // Background read-cursor bookkeeping; never claims "saved" to anyone.
  ["markConversationRead", "background"],
  // Redirect-only flows that land on a visible success or error banner.
  ["claimShipper", "redirects to ?claim=ok|failed"],
  ["startShipperCardSetup", "redirects to Stripe or ?card=error"],
  ["startIdentityVerification", "redirects to Stripe or ?verification=error"],
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(e.name) && !e.name.includes(".test.") ? [p] : [];
  });
}

test("no server action returns nothing (except reviewed redirect/background ones)", () => {
  const silent: string[] = [];
  for (const path of sourceFiles("app")) {
    const text = readFileSync(path, "utf8");
    if (!text.startsWith('"use server"')) continue;
    for (const m of text.matchAll(/export async function (\w+)\([^)]*\)\s*:\s*Promise<void>/g)) {
      if (!ALLOWED_VOID.has(m[1])) silent.push(`${path}: ${m[1]}`);
    }
  }
  assert.deepEqual(silent, []);
});

test("every admin action writes the audit log (directly or via a shared helper)", () => {
  for (const path of sourceFiles(join("app", "admin"))) {
    const text = readFileSync(path, "utf8");
    if (!text.startsWith('"use server"')) continue;
    // Split into top-level functions; a helper "logs" if its body calls logAdminAction.
    const chunks = text.split(/\n(?=(?:export )?async function )/);
    const logs = new Set<string>();
    for (const c of chunks) {
      const name = /async function (\w+)/.exec(c)?.[1];
      if (name && c.includes("logAdminAction(")) logs.add(name);
    }
    for (const c of chunks) {
      const m = /^export async function (\w+)/.exec(c.trimStart());
      if (!m) continue;
      const delegates = [...logs].some((h) => h !== m[1] && new RegExp(`\\b${h}\\(`).test(c));
      assert.ok(logs.has(m[1]) || delegates, `${path}: ${m[1]} doesn't write the audit log`);
    }
  }
});
