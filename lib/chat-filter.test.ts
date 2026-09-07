import { test } from "node:test";
import assert from "node:assert/strict";
import { scanForContactInfo, CONTACT_INFO_BLOCK_MESSAGE } from "./chat-filter.ts";

function blocked(msg: string) {
  return scanForContactInfo(msg).ok === false;
}

test("clean messages pass", () => {
  for (const msg of [
    "Hi, is this vehicle still available?",
    "Can you share more photos of the interior?",
    "What's the lowest you'd take for it?",
    "I can wire $45,000 once MOVA confirms the deal.",
    "The 2015 model with 62,000 miles — is the timing belt done?",
    "Let's chat at noon about the inspection.",
    "Rate it out of 10 for me, that scratch aside.",
    "Sounds good. I'll wait for MOVA to connect us.",
  ]) {
    assert.equal(scanForContactInfo(msg).ok, true, `expected clean: ${msg}`);
  }
});

test("plain e-mail addresses are blocked", () => {
  assert.ok(blocked("email me at john.doe@gmail.com"));
  assert.ok(blocked("JANE_SELLER@outlook.co.uk works best"));
  assert.ok(scanForContactInfo("reach me: a@b.io").categories.includes("email"));
});

test("obfuscated e-mail addresses are blocked", () => {
  assert.ok(blocked("john dot doe at gmail dot com"));
  assert.ok(blocked("john (at) gmail (dot) com"));
  assert.ok(blocked("john @ gmail . com"));
  assert.ok(blocked("contact: seller [at] yahoo [dot] com"));
  assert.ok(blocked("name at gmail.com"));
});

test("phone numbers in many formats are blocked", () => {
  for (const msg of [
    "call 08012345678",
    "my cell is +234 801 234 5678",
    "reach me on (415) 555-0132",
    "415-555-0132 anytime",
    "+1 415.555.0132",
    "number: 4155550132",
  ]) {
    assert.ok(blocked(msg), `expected blocked: ${msg}`);
  }
});

test("prices and short numbers are not treated as phone numbers", () => {
  assert.equal(scanForContactInfo("I'll pay $1,250,000 cash").ok, true);
  assert.equal(scanForContactInfo("asking 45000, firm").ok, true);
  assert.equal(scanForContactInfo("VIN ends 1G1 and year is 2015").ok, true);
});

test("URLs and bare domains are blocked", () => {
  assert.ok(blocked("see my other listings at http://example.com/car"));
  assert.ok(blocked("www.mycars.ng has more"));
  assert.ok(blocked("find me on carsforsale.com"));
});

test("social handles and messaging apps are blocked", () => {
  assert.ok(blocked("dm me @john_seller"));
  assert.ok(blocked("I'm on WhatsApp, ping me"));
  assert.ok(blocked("add me on telegram"));
  assert.ok(blocked("my insta is better for photos"));
});

test("circumvention phrases are blocked", () => {
  for (const msg of [
    "call me and we'll sort it out",
    "text me when you're ready",
    "reach me on whatsapp",
    "give me your number",
    "let's take this off-platform",
    "let's finish this outside MOVA",
    "here's my number, ready when you are",
  ]) {
    assert.ok(blocked(msg), `expected blocked: ${msg}`);
  }
});

test("scan reports the matched categories", () => {
  const res = scanForContactInfo("call me at 08012345678 or email x@y.com");
  assert.ok(res.categories.includes("phone"));
  assert.ok(res.categories.includes("email"));
  assert.ok(res.categories.includes("circumvention_phrase"));
});

test("block message is stable copy", () => {
  assert.match(CONTACT_INFO_BLOCK_MESSAGE, /MOVA connects you directly/);
});
