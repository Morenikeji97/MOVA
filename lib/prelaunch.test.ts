import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { isPrelaunch, toInternationalWhatsapp, validateWaitlist } from "./prelaunch.ts";

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

// ---------------------------------------------------------------------------
// toInternationalWhatsapp — always "+<country code><number>"
// ---------------------------------------------------------------------------

const e164 = (raw: string, country: Parameters<typeof toInternationalWhatsapp>[1]) => {
  const r = toInternationalWhatsapp(raw, country);
  return r.ok ? r.e164 : null;
};

test("whatsapp: Nigeria national 0803 123 4567 -> +2348031234567", () => {
  assert.equal(e164("0803 123 4567", "NG"), "+2348031234567");
});

test("whatsapp: Nigeria without the trunk 0, and 234… without the +", () => {
  assert.equal(e164("803 123 4567", "NG"), "+2348031234567");
  assert.equal(e164("2348031234567", "NG"), "+2348031234567");
});

test("whatsapp: US 631-617-3816 -> +16316173816", () => {
  assert.equal(e164("631-617-3816", "US"), "+16316173816");
});

test("whatsapp: US 1 631… without the + (how the phone test was stored)", () => {
  assert.equal(e164("1 631 617 3816", "US"), "+16316173816");
});

test("whatsapp: Ghana 024 123 4567 -> +233241234567", () => {
  assert.equal(e164("024 123 4567", "GH"), "+233241234567");
});

test("whatsapp: Togo 8 digits -> +228…", () => {
  assert.equal(e164("90 12 34 56", "TG"), "+22890123456");
});

test("whatsapp: Benin 10-digit 01… -> +22901…; old 8-digit form is rejected", () => {
  assert.equal(e164("01 97 12 34 56", "BJ"), "+2290197123456");
  assert.equal(e164("97 12 34 56", "BJ"), null);
});

test("whatsapp: phone-keyboard punctuation (NBSP, non-breaking hyphen) is accepted", () => {
  assert.equal(e164("+1 (631) 617‑3816", "US"), "+16316173816");
});

test("whatsapp: 00 international prefix becomes +", () => {
  assert.equal(e164("00233 24 123 4567", "GH"), "+233241234567");
});

test("whatsapp: a foreign number typed with + is kept, whatever the country", () => {
  assert.equal(e164("+44 7911 123456", "NG"), "+447911123456");
});

test("whatsapp: + number in the selected country's code must be that country's length", () => {
  assert.equal(e164("+234 803 123 456", "NG"), null); // 9 digits after 234
});

test("whatsapp: Other needs a country code", () => {
  const r = toInternationalWhatsapp("631 617 3816", "OTHER");
  assert.equal(r.ok, false);
  assert.match(r.ok ? "" : r.error, /country code/);
  assert.equal(e164("+1 631 617 3816", "OTHER"), "+16316173816");
});

test("whatsapp: wrong length for the country is rejected with the country named", () => {
  const r = toInternationalWhatsapp("0803 123 456", "NG");
  assert.equal(r.ok, false);
  assert.match(r.ok ? "" : r.error, /Nigeria/);
});

test("whatsapp: US numbers can't start with 0 or 1 after the country code", () => {
  assert.equal(e164("131 617 3816", "US"), null);
});

test("whatsapp: too short or too long international numbers are rejected", () => {
  assert.equal(e164("+12 34", "OTHER"), null);
  assert.equal(e164("+1234567890123456", "OTHER"), null);
});

test("waitlist: a national number is stored internationally for the chosen country", () => {
  const r = validateWaitlist({ email: "", whatsapp: "0803 123 4567", country: "NG" });
  assert.deepEqual(r, { ok: true, email: null, whatsapp: "+2348031234567", country: "NG" });
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
  assert.equal(validateWaitlist({ email: "a@b.co", whatsapp: "", country: "XX" }).ok, false);
});
