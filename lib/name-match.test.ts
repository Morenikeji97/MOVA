import { test } from "node:test";
import assert from "node:assert/strict";
import { editDistance, matchName, nameTokens } from "./name-match.ts";

const rec = { firstName: "Oluwaseun", middleName: "Adebayo", lastName: "Okafor" };

test("same names, any order, any case, accents and punctuation ignored", () => {
  assert.equal(matchName("Oluwaseun Okafor", rec), "match");
  assert.equal(matchName("OKAFOR Oluwaseun", rec), "match");
  assert.equal(matchName("Oluwaseun Adebayo Okafor", rec), "match");
  assert.equal(matchName("okafor, oluwaseun adebayo", rec), "match");
  assert.equal(matchName("Kofi Mensah-Boateng", { firstName: "Kofi", lastName: "Mensah Boateng" }), "match");
  assert.equal(matchName("Sèna Hounkpè", { firstName: "Sena", lastName: "Hounkpe" }), "match");
});

test("one small spelling slip per longer name is close, not a mismatch", () => {
  assert.equal(matchName("Oluwasegun Okafor", rec), "close");
  assert.equal(matchName("Oluwaseun Okafoor", rec), "close");
});

test("a different person, a missing surname, or one word is a mismatch (goes to review)", () => {
  assert.equal(matchName("Chinedu Okafor", rec), "mismatch");
  assert.equal(matchName("Oluwaseun Adebayo", rec), "mismatch");
  assert.equal(matchName("Okafor", rec), "mismatch");
  assert.equal(matchName("Oluwaseun Okafor Smith", rec), "mismatch");
});

test("short names must be exact (no slip allowed under 5 letters)", () => {
  const r = { firstName: "Ada", lastName: "Obi" };
  assert.equal(matchName("Ada Obi", r), "match");
  assert.equal(matchName("Ade Obi", r), "mismatch");
});

test("a record with no name can't match", () => {
  assert.equal(matchName("John Doe", { firstName: null, lastName: null }), "mismatch");
});

test("helpers", () => {
  assert.deepEqual(nameTokens("  Mary-Jane  O'Neil "), ["mary", "jane", "o", "neil"]);
  assert.equal(editDistance("okafor", "okafoor"), 1);
  assert.equal(editDistance("a", "abcdef"), 3);
});
