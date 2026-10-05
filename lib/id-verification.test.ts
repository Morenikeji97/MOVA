import { test } from "node:test";
import assert from "node:assert/strict";
import { isIdVerificationLive } from "./id-verification.ts";

const keys = { DOJAH_SECRET_KEY: "sk", DOJAH_APP_ID: "app" };

test("only Dojah's live API with keys counts as live", () => {
  assert.equal(isIdVerificationLive({ ...keys, DOJAH_BASE_URL: "https://api.dojah.io" }), true);
  assert.equal(isIdVerificationLive({ ...keys, DOJAH_BASE_URL: "https://api.dojah.io/" }), true);
});

test("sandbox, unset, or missing keys is not live (no real NIN leaves ShipMova)", () => {
  assert.equal(isIdVerificationLive({ ...keys, DOJAH_BASE_URL: "https://sandbox.dojah.io" }), false);
  assert.equal(isIdVerificationLive({ ...keys }), false);
  assert.equal(isIdVerificationLive({ DOJAH_BASE_URL: "https://api.dojah.io" }), false);
});
