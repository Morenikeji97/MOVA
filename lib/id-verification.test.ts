import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanIdNumber,
  cleanLegalName,
  idCountry,
  isIdVerificationLive,
  mayContactDojah,
} from "./id-verification.ts";

const keys = { DOJAH_SECRET_KEY: "sk", DOJAH_APP_ID: "app" };
const sandbox = { ...keys, DOJAH_BASE_URL: "https://sandbox.dojah.io" };
const live = { ...keys, DOJAH_BASE_URL: "https://api.dojah.io" };

test("only Dojah's live API with keys counts as live", () => {
  assert.equal(isIdVerificationLive(live), true);
  assert.equal(isIdVerificationLive({ ...live, DOJAH_BASE_URL: "https://api.dojah.io/" }), true);
  assert.equal(isIdVerificationLive(sandbox), false);
  assert.equal(isIdVerificationLive(keys), false);
  assert.equal(isIdVerificationLive({ DOJAH_BASE_URL: "https://api.dojah.io" }), false);
});

test("in sandbox only Dojah's published test numbers may be sent", () => {
  assert.equal(mayContactDojah("ng_nin", "70123456789", sandbox), true);
  assert.equal(mayContactDojah("ng_nin", "12345678901", sandbox), false);
  assert.equal(mayContactDojah("gh_card", "GHA-123456789-0", sandbox), false);
});

test("live, any well-formed number may be sent", () => {
  assert.equal(mayContactDojah("ng_nin", "12345678901", live), true);
  assert.equal(mayContactDojah("gh_card", "GHA-123456789-0", live), true);
});

test("ID number shapes", () => {
  assert.equal(cleanIdNumber("ng_nin", " 701 2345 6789 "), "70123456789");
  assert.equal(cleanIdNumber("ng_nin", "7012345678"), null);
  assert.equal(cleanIdNumber("gh_card", "gha-123456789-0"), "GHA-123456789-0");
  assert.equal(cleanIdNumber("gh_card", "GHA1234567890"), "GHA-123456789-0");
  assert.equal(cleanIdNumber("gh_card", "GHA-12345-0"), null);
});

test("legal names", () => {
  assert.equal(cleanLegalName("  Ada   Obi "), "Ada Obi");
  assert.equal(cleanLegalName("Sèna Hounkpè"), "Sèna Hounkpè");
  assert.equal(cleanLegalName("Ada"), null);
  assert.equal(cleanLegalName("Ada 0bi"), null);
});

test("country methods", () => {
  assert.equal(idCountry("NG")?.method, "ng_nin");
  assert.equal(idCountry("GH")?.method, "gh_card");
  assert.equal(idCountry("TG")?.method, "document");
  assert.equal(idCountry("BJ")?.method, "document");
  assert.equal(idCountry("US"), null);
});
