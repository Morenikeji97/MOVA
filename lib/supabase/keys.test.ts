import { test } from "node:test";
import assert from "node:assert/strict";
import { assertSupabaseKey } from "./keys.ts";

const legacyJwt = (role: string) =>
  `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ iss: "supabase", role })).replace(/=+$/, "")}.sig`;

// Dummy keys — only the `sb_publishable_` / `sb_secret_` prefix matters to
// assertSupabaseKey. Never put a real key in a test fixture.
test("accepts a publishable key in the publishable slot", () => {
  const k = "sb_publishable_x";
  assert.equal(assertSupabaseKey(k, "publishable", "X"), k);
});

test("accepts a secret key in the secret slot", () => {
  const k = "sb_secret_x";
  assert.equal(assertSupabaseKey(k, "secret", "X"), k);
});

test("accepts legacy JWT keys in the matching slot", () => {
  assert.doesNotThrow(() => assertSupabaseKey(legacyJwt("anon"), "publishable", "X"));
  assert.doesNotThrow(() => assertSupabaseKey(legacyJwt("service_role"), "secret", "X"));
});

test("rejects a JWT Signing Key ID (UUID) with a pointed hint", () => {
  assert.throws(
    () => assertSupabaseKey("88d278f6-df21-42f5-be5f-4f477877b2c4", "publishable", "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    /JWT Signing Key ID/,
  );
});

test("rejects an unset / empty value", () => {
  assert.throws(() => assertSupabaseKey(undefined, "publishable", "X"), /is not set/);
  assert.throws(() => assertSupabaseKey("", "secret", "X"), /is not set/);
});

test("rejects a random non-key string", () => {
  assert.throws(() => assertSupabaseKey("hunter2", "publishable", "X"), /does not look like a Supabase API key/);
});

test("rejects a secret key exposed in the publishable slot", () => {
  assert.throws(
    () => assertSupabaseKey("sb_secret_abc123", "publishable", "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    /SECRET key .* exposed in a public/,
  );
});

test("rejects a legacy service_role JWT exposed in the publishable slot", () => {
  assert.throws(
    () => assertSupabaseKey(legacyJwt("service_role"), "publishable", "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    /legacy service_role key exposed in a public/,
  );
});

test("rejects a publishable key used in the secret slot", () => {
  assert.throws(
    () => assertSupabaseKey("sb_publishable_abc123", "secret", "SUPABASE_SERVICE_ROLE_KEY"),
    /publishable key but is used server-side/,
  );
});

test("rejects a legacy anon JWT used in the secret slot", () => {
  assert.throws(
    () => assertSupabaseKey(legacyJwt("anon"), "secret", "SUPABASE_SERVICE_ROLE_KEY"),
    /legacy anon key but is used server-side/,
  );
});
