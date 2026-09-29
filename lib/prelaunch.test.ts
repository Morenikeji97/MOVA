import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { isPrelaunch, normalizeWhatsapp, validateWaitlist } from "./prelaunch.ts";

const original = process.env.PRELAUNCH;
afterEach(() => {
  if (original === undefined) delete process.env.PRELAUNCH;
  else process.env.PRELAUNCH = original;
});

// ---------------------------------------------------------------------------
// isPrelaunch — fails closed
// ---------------------------------------------------------------------------

test("prelaunch is on when PRELAUNCH=true", () => {
  process.env.PRELAUNCH = "true";
  assert.equal(isPrelaunch(), true);
});

test("prelaunch is on when PRELAUNCH is unset", () => {
  delete process.env.PRELAUNCH;
  assert.equal(isPrelaunch(), true);
});

test("prelaunch is on for a typo, not just 'true'", () => {
  process.env.PRELAUNCH = "flase";
  assert.equal(isPrelaunch(), true);
});

test("prelaunch is off only for 'false' (any case, trimmed)", () => {
  process.env.PRELAUNCH = " False ";
  assert.equal(isPrelaunch(), false);
});

// ---------------------------------------------------------------------------
// validateWaitlist
// ---------------------------------------------------------------------------

test("waitlist: email alone is enough, and is lower-cased", () => {
  assert.deepEqual(validateWaitlist({ email: " Ada@Example.com ", whatsapp: "", country: "NG" }), {
    ok: true,
    email: "ada@example.com",
    whatsapp: null,
    country: "NG",
  });
});

test("waitlist: WhatsApp alone is enough, stored as +digits", () => {
  assert.deepEqual(validateWaitlist({ email: "", whatsapp: "+234 803 123 4567", country: "GH" }), {
    ok: true,
    email: null,
    whatsapp: "+2348031234567",
    country: "GH",
  });
});

test("whatsapp: phone-keyboard punctuation (NBSP, non-breaking hyphen) is accepted", () => {
  assert.equal(normalizeWhatsapp("+1 (631) 617‑3816"), "+16316173816");
});

test("whatsapp: 00 international prefix becomes +", () => {
  assert.equal(normalizeWhatsapp("00233 20 123 4567"), "+233201234567");
});

test("whatsapp: too short or too long is rejected", () => {
  assert.equal(normalizeWhatsapp("+12 34"), null);
  assert.equal(normalizeWhatsapp("+1234567890123456"), null);
});

test("waitlist: needs one of email or WhatsApp", () => {
  const r = validateWaitlist({ email: " ", whatsapp: "", country: "NG" });
  assert.equal(r.ok, false);
});

test("waitlist: rejects a malformed email", () => {
  assert.equal(validateWaitlist({ email: "ada@", whatsapp: "", country: "NG" }).ok, false);
});

test("waitlist: rejects a WhatsApp number with letters", () => {
  assert.equal(validateWaitlist({ email: "", whatsapp: "call me", country: "NG" }).ok, false);
});

test("waitlist: rejects an unknown country", () => {
  assert.equal(validateWaitlist({ email: "a@b.co", whatsapp: "", country: "US" }).ok, false);
});
