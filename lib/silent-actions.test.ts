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

test("every confirmed-write admin action writes the audit log", () => {
  for (const path of sourceFiles(join("app", "admin"))) {
    const text = readFileSync(path, "utf8");
    if (!text.startsWith('"use server"')) continue;
    const actions = [...text.matchAll(/export async function (\w+)/g)].length;
    const audits = [...text.matchAll(/logAdminAction\(/g)].length;
    assert.ok(audits >= actions, `${path}: ${actions} actions but ${audits} audit calls`);
  }
});
