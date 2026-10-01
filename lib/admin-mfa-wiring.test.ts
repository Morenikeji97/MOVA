import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Static guard for lib/admin-mfa.ts: every admin role check in app/ must be
// followed by requireAdminMfa(), and every admin page or action that uses
// the service-role key must call it. Server actions are reachable by id from
// any page and the service role bypasses is_admin() in RLS, so these checks
// are the only thing stopping a password-only (aal1) admin session there.

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [path] : [];
  });
}

const ROLE_CHECK = /role (!|=)== "admin"/;
// The code page itself checks the role, then the code, via hasMfaSession().
const CODE_PAGE = join("app", "mfa", "page.tsx");

const files = sourceFiles("app").map((path) => ({ path, text: readFileSync(path, "utf8") }));

test("every admin role check is followed by requireAdminMfa()", () => {
  const checked: string[] = [];
  for (const { path, text } of files) {
    if (path === CODE_PAGE) continue;
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      if (!ROLE_CHECK.test(line)) return;
      checked.push(path);
      const after = lines.slice(i + 1, i + 4).join("\n");
      assert.match(after, /await requireAdminMfa\(/, `${path}:${i + 1} checks the admin role without the code`);
    });
  }
  // Fails loudly if the pattern stops matching (e.g. a refactor renames the
  // check) instead of passing vacuously.
  assert.ok(checked.length >= 9, `expected at least 9 admin role checks, found ${checked.length}`);
});

test("every admin page or action using the service-role key requires the code", () => {
  for (const { path, text } of files) {
    if (!path.startsWith(join("app", "admin")) || !text.includes("createAdminClient")) continue;
    assert.match(text, /requireAdminMfa\(/, `${path} uses the service role without requireAdminMfa()`);
  }
});

test("the code page checks the code before letting an admin through", () => {
  const page = files.find((f) => f.path === CODE_PAGE);
  assert.ok(page, "app/mfa/page.tsx is missing");
  assert.match(page.text, /hasMfaSession\(/);
});
