import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scanForContactInfo,
  CONTACT_INFO_BLOCK_MESSAGE,
  CIRCUMVENTION_BLOCK_MESSAGE,
} from "./chat-filter.ts";

function blocked(msg: string) {
  return scanForContactInfo(msg).ok === false;
}
function cats(msg: string) {
  return scanForContactInfo(msg).categories;
}
function reason(msg: string) {
  return scanForContactInfo(msg).message;
}

// Wraps a probe string in ordinary buyer/seller chatter so we exercise the
// "hidden in a real message" path, not just standalone probes.
function embedded(probe: string) {
  return `Hey, love the car! Quick one — ${probe} — thanks in advance!`;
}

// ---------------------------------------------------------------------------
// Existing behavior (must stay green)
// ---------------------------------------------------------------------------

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
  assert.ok(cats("reach me: a@b.io").includes("email"));
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
  assert.equal(scanForContactInfo("out the door it's 45000.00 even").ok, true);
  assert.equal(scanForContactInfo("₦1,250,000 is my top offer").ok, true);
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

test("literal contact-exchange phrases are blocked", () => {
  for (const msg of [
    "call me and we'll sort it out",
    "text me when you're ready",
    "reach me on whatsapp",
    "give me your number",
    "here's my number, ready when you are",
    "what's your number?",
  ]) {
    assert.ok(blocked(msg), `expected blocked: ${msg}`);
    assert.equal(reason(msg), CONTACT_INFO_BLOCK_MESSAGE, msg);
  }
});

test("scan reports the matched categories", () => {
  const res = scanForContactInfo("call me at 08012345678 or email x@y.com");
  assert.ok(res.categories.includes("phone"));
  assert.ok(res.categories.includes("email"));
  assert.ok(res.categories.includes("circumvention_phrase"));
});

test("block messages are stable copy", () => {
  assert.match(CONTACT_INFO_BLOCK_MESSAGE, /MOVA connects you directly/);
  assert.match(CIRCUMVENTION_BLOCK_MESSAGE, /keep this on MOVA/i);
  assert.notEqual(CONTACT_INFO_BLOCK_MESSAGE, CIRCUMVENTION_BLOCK_MESSAGE);
});

// ---------------------------------------------------------------------------
// 1. Spelled-out / broken-up numbers
// ---------------------------------------------------------------------------

test("spelled-out phone numbers are blocked", () => {
  for (const probe of [
    "four one five five five five zero one three two",
    "oh eight zero one two three four five six seven eight",
    "my digits: four one five, five five five, zero one three two",
  ]) {
    assert.ok(blocked(probe), probe);
    assert.ok(blocked(embedded(probe)), embedded(probe));
    assert.ok(cats(probe).includes("phone"), probe);
  }
});

test("mixed / filler digit separators are blocked", () => {
  for (const probe of [
    "415 . 555 . 0132",
    "4-1-5-5-5-5-0-1-3-2",
    "415/555/0132",
    "4 1 5 5 5 5 0 1 3 2",
    "415 uh 555 uh 0132",
    "call it at 415_555_0132",
  ]) {
    assert.ok(blocked(probe), probe);
    assert.ok(blocked(embedded(probe)), embedded(probe));
  }
});

test("spelled-out digits do not false-positive on ordinary counting", () => {
  assert.equal(scanForContactInfo("one or two more photos would be great").ok, true);
  assert.equal(scanForContactInfo("it seats five, maybe six with kids").ok, true);
  assert.equal(
    scanForContactInfo("five thousand five hundred is my offer").ok,
    true,
  );
});

// ---------------------------------------------------------------------------
// 2. Handles without an "@"
// ---------------------------------------------------------------------------

test("social handles given without an @ are blocked", () => {
  for (const probe of [
    "find me on instagram username johndoe123",
    "my ig is johndoe123",
    "IG: johndoe123",
    "insta johndoe123",
    "snapchat handle is jd_speedy",
    "add me on telegram, username carguy_99",
    "my screen name is fastcars_ng",
  ]) {
    assert.ok(blocked(probe), probe);
    assert.ok(blocked(embedded(probe)), embedded(probe));
    assert.ok(cats(probe).includes("social_handle"), probe);
  }
});

test("plain talk about platforms without a handle stays readable-ish", () => {
  // "instagram" alone already trips the platform rule (existing behavior); make
  // sure a bare handle-shaped word without a platform does NOT.
  assert.equal(scanForContactInfo("the seats look great in these photos").ok, true);
  assert.equal(scanForContactInfo("model year 2015, trim is EX-L").ok, true);
});

// ---------------------------------------------------------------------------
// 3. Intent-based circumvention questions (no literal contact info)
// ---------------------------------------------------------------------------

test("intent-based circumvention questions are HARD blocked", () => {
  for (const probe of [
    "how can I contact you outside this app",
    "can we talk somewhere else",
    "is there a way to reach you directly",
    "can I just buy this from you outside the platform",
    "can we skip the fee and deal directly",
    "what's the best way to reach you",
    "do you have another way I can reach you",
    "let's cut out the middleman",
    "any way we can do this off MOVA?",
    "can we finish this privately to avoid the fee",
    "how do we close this without MOVA taking a cut",
  ]) {
    assert.ok(blocked(probe), `expected blocked: ${probe}`);
    assert.ok(blocked(embedded(probe)), embedded(probe));
    assert.ok(
      cats(probe).includes("circumvention_intent"),
      `expected circumvention_intent: ${probe}`,
    );
  }
});

test("intent-only messages show the circumvention reason, not the contact-info one", () => {
  for (const probe of [
    "can we talk somewhere else",
    "what's the best way to reach you",
    "let's cut out the middleman",
    "can we skip the fee and deal directly",
  ]) {
    assert.equal(reason(probe), CIRCUMVENTION_BLOCK_MESSAGE, probe);
  }
});

test("a message with an actual number still shows the contact-info reason", () => {
  const probe = "let's deal directly, my number is 415 555 0132";
  assert.equal(reason(probe), CONTACT_INFO_BLOCK_MESSAGE);
});

test("legitimate deal / price / contact talk is NOT flagged as circumvention", () => {
  for (const msg of [
    "can I buy this car?",
    "how do I contact MOVA support?",
    "can we discuss the price a bit?",
    "I'll pay you directly once MOVA confirms the deal",
    "I'll wire the balance to the seller after the fee clears",
    "does MOVA connect us after payment?",
    "can you deliver directly to the port in Lagos?",
    "let's do the deal this week if the inspection is clean",
  ]) {
    assert.equal(scanForContactInfo(msg).ok, true, `expected clean: ${msg}`);
  }
});

// ---------------------------------------------------------------------------
// 4. Physical meetup / address exchange
// ---------------------------------------------------------------------------

test("physical meetup / address exchange is blocked", () => {
  for (const probe of [
    "meet me at the Shell station on Main",
    "come to my dealership at 1200 Elm Street",
    "swing by the lot this weekend",
    "let's just handle this in person",
    "what's your address so I can come see it",
    "1200 Elm Street, unit B",
    "123 Main St",
    "Austin, TX 75001",
    "come get it from my garage, address is 44 Oak Ave",
  ]) {
    assert.ok(blocked(probe), probe);
    assert.ok(blocked(embedded(probe)), embedded(probe));
    assert.ok(cats(probe).includes("address"), probe);
  }
});

test("address detection does not fire on prices, years or mileage", () => {
  assert.equal(scanForContactInfo("it's 5000 way under book value").ok, true);
  assert.equal(scanForContactInfo("2003 model, 120000 miles on it").ok, true);
  assert.equal(scanForContactInfo("I can be at 4500 for it, cash").ok, true);
});

// ---------------------------------------------------------------------------
// 5. Leetspeak / homoglyph substitution
// ---------------------------------------------------------------------------

test("leetspeak inside otherwise-blocked phrases is caught and flagged as evasion", () => {
  for (const probe of [
    "c4ll me at 415 555 0132",
    "wh4ts4pp me when you can",
    "t3xt m3 l8r",
    "let's take this 0ff pl4tform",
    "my 1g is johndoe123",
  ]) {
    assert.ok(blocked(probe), probe);
    assert.ok(blocked(embedded(probe)), embedded(probe));
    assert.ok(cats(probe).includes("evasion"), `expected evasion: ${probe}`);
  }
});

test("homoglyph (Cyrillic look-alike) substitution is caught", () => {
  // "саll mе" and "оutside МОVА" use Cyrillic с/а/е/о/М/О/V/А
  assert.ok(blocked("саll mе when you get this"));
  assert.ok(blocked("let's move this оutside mоva"));
  assert.ok(cats("саll mе when you get this").includes("evasion"));
});

test("leet normalization does not corrupt clean messages", () => {
  for (const msg of [
    "gr8 condition for a 2015",
    "I have 5 seats and 4 doors, all power",
    "a1 tyres, 62000 miles",
  ]) {
    assert.equal(scanForContactInfo(msg).ok, true, `expected clean: ${msg}`);
  }
});

// ---------------------------------------------------------------------------
// Combined / embedded
// ---------------------------------------------------------------------------

test("harder circumvention variants are blocked", () => {
  for (const probe of [
    "is there somewhere private we can continue this",
    "can we handle the sale without going through MOVA",
    "what other ways can I get in touch with you",
    "would you sell it to me directly if I paid a bit more",
    "any chance we do this between us to save the fee",
    "can we move this conversation to a different app",
    "let's just talk over WhatsApp, it's easier",
  ]) {
    assert.ok(blocked(probe), probe);
    assert.ok(cats(probe).includes("circumvention_intent"), probe);
  }
});

test("handles without an @ or a colon are still caught", () => {
  assert.ok(blocked("better to see build pics on my snap, its rideswithtee"));
  assert.ok(blocked("tiktok handle is tee.motors"));
  assert.ok(blocked("catch me on telegram, id is tee_exports_01"));
});

test("more meetup phrasings are caught", () => {
  for (const probe of [
    "can I come look at it in your driveway",
    "easier if you just bring it to my office Saturday",
    "swing by and see it this weekend",
    "come see the car in person",
  ]) {
    assert.ok(blocked(probe), probe);
    assert.ok(cats(probe).includes("address"), probe);
  }
});

test("broader false-positive guard: normal negotiation still sends", () => {
  for (const msg of [
    "Come see what I mean in the third picture — there's a small dent.",
    "Is there another way to verify the mileage besides the odometer pic?",
    "I'll pay the seller directly for the car once MOVA releases the details.",
    "The carfax is on a different site, I'll check it myself.",
    "Would you consider a different price if I pay the full fee?",
    "Let's continue once the inspection report is back.",
    "Can we keep talking about the trim options?",
    "different trim, same year — is that also available?",
    "I'll be reaching out through MOVA support about the fee split.",
    "What's the best way to pay the reservation fee?",
    "Another option is RoRo shipping instead of container.",
    "Can you bring the price down a little?",
  ]) {
    assert.equal(scanForContactInfo(msg).ok, true, `expected clean: ${msg}`);
  }
});

test("probes buried in friendly chatter are still blocked", () => {
  assert.ok(blocked("Hey, love the car! By the way, can we just deal directly?"));
  assert.ok(
    blocked(
      "Thanks for the quick reply. If it helps, my ig is johndoe123 — more pics there.",
    ),
  );
  assert.ok(
    blocked(
      "Great, sounds good. What's the best way to reach you if I have questions?",
    ),
  );
  assert.ok(
    blocked(
      "Appreciate it. Rather than pay the fee, could we sort this out off the platform?",
    ),
  );
});
