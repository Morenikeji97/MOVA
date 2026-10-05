import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Static guard for admin access (lib/admin-auth.ts, lib/admin-mfa.ts).
// Server actions are reachable by id from any page and the service role
// bypasses is_admin() in RLS, so the code-checked admin check in the app is
// the only thing stopping a password-only (aal1) admin session there.

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

test("the shared admin check (lib/admin-auth.ts) requires the code after the role", () => {
  const src = readFileSync("lib/admin-auth.ts", "utf8");
  const role = src.search(ROLE_CHECK);
  const mfa = src.indexOf("await requireAdminMfa(");
  assert.ok(role > 0, "lib/admin-auth.ts has no admin role check");
  assert.ok(mfa > role, "lib/admin-auth.ts must call requireAdminMfa after the role check");
});

test("admin action files use the shared check, never their own copy", () => {
  const actionFiles = files.filter(
    (f) =>
      f.text.startsWith('"use server"') &&
      (f.path.startsWith(join("app", "admin")) || f.path === join("app", "reviews", "actions.ts")),
  );
  assert.ok(actionFiles.length >= 7, `expected the 7 admin action files, found ${actionFiles.length}`);
  for (const { path, text } of actionFiles) {
    assert.doesNotMatch(text, /async function requireAdmin\b/, `${path} defines its own requireAdmin`);
    assert.match(text, /from "@\/lib\/admin-auth"/, `${path} doesn't import the shared requireAdmin`);
  }
});

test("any remaining admin role check in app/ is followed by requireAdminMfa()", () => {
  for (const { path, text } of files) {
    if (path === CODE_PAGE) continue;
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      if (!ROLE_CHECK.test(line)) return;
      const after = lines.slice(i + 1, i + 4).join("\n");
      assert.match(after, /await requireAdminMfa\(/, `${path}:${i + 1} checks the admin role without the code`);
    });
  }
});

test("every admin page or action using the service-role key requires the code", () => {
  for (const { path, text } of files) {
    if (!path.startsWith(join("app", "admin")) || !text.includes("createAdminClient")) continue;
    assert.ok(
      /requireAdminMfa\(/.test(text) || /from "@\/lib\/admin-auth"/.test(text),
      `${path} uses the service role without the code-checked admin check`,
    );
  }
});

test("the code page checks the code before letting an admin through", () => {
  const page = files.find((f) => f.path === CODE_PAGE);
  assert.ok(page, "app/mfa/page.tsx is missing");
  assert.match(page.text, /hasMfaSession\(/);
});
