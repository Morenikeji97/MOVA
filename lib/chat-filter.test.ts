import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scanForContactInfo,
  CONTACT_INFO_BLOCK_MESSAGE,
  CIRCUMVENTION_BLOCK_MESSAGE,
  PAYMENT_BLOCK_MESSAGE,
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
    "I can wire $45,000 once ShipMova confirms the deal.",
    "The 2015 model with 62,000 miles — is the timing belt done?",
    "Let's chat at noon about the inspection.",
    "Rate it out of 10 for me, that scratch aside.",
    "Sounds good. I'll wait for ShipMova to connect us.",
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
  assert.match(CONTACT_INFO_BLOCK_MESSAGE, /can't be shared in chat/);
  assert.match(CIRCUMVENTION_BLOCK_MESSAGE, /keep this on ShipMova/i);
  assert.equal(
    PAYMENT_BLOCK_MESSAGE,
    "For your protection, all car payments go through Escrow.com on ShipMova.",
  );
  assert.notEqual(CONTACT_INFO_BLOCK_MESSAGE, CIRCUMVENTION_BLOCK_MESSAGE);
});

test("no block message promises a contact reveal after payment", () => {
  for (const m of [CONTACT_INFO_BLOCK_MESSAGE, CIRCUMVENTION_BLOCK_MESSAGE, PAYMENT_BLOCK_MESSAGE]) {
    assert.doesNotMatch(m, /connects you directly|unlocks|after (the deal|payment) is confirmed/i);
  }
});

// ---------------------------------------------------------------------------
// Off-platform payment -> the escrow message
// ---------------------------------------------------------------------------

test("off-platform payment attempts are blocked with the escrow message", () => {
  for (const probe of [
    "pay me directly",
    "Can I pay you directly for the car?",
    "just pay the seller directly",
    "I'll pay you directly once ShipMova confirms the deal",
    "I'll wire the balance to the seller after the fee clears",
    "I'll pay the seller directly for the car once ShipMova releases the details.",
    "wire it to me",
    "transfer the money to my account",
    "send the money to my account",
    "send me the deposit",
    "pay directly to me and I'll knock $500 off",
    "can I just pay directly?",
    "Zelle me the deposit",
    "zelle me",
    "CashApp me",
    "cash app works",
    "PayPal me the balance",
    "paypal is easier",
    "I take Venmo",
    "send it by Western Union",
    "we can do bitcoin",
    "let's skip escrow",
    "we don't need escrow for this",
    "can we do it without escrow?",
    "pay outside of escrow and save the fee",
    "I'll give you my bank account number",
    "what's your account number?",
    "iban please",
    "pay me in cash at pickup",
    "cash on delivery is fine",
  ]) {
    assert.ok(blocked(probe), `expected blocked: ${probe}`);
    assert.equal(reason(probe), PAYMENT_BLOCK_MESSAGE, `expected escrow message: ${probe}`);
    assert.ok(cats(probe).includes("payment_circumvention"), probe);
    assert.ok(blocked(embedded(probe)), embedded(probe));
  }
});

test("misspellings and spacing tricks around payments are caught", () => {
  for (const probe of [
    "p a y  m e  d i r e c t l y",
    "z e l l e me",
    "z.e.l.l.e",
    "zele me the money",
    "cashap me",
    "pay pal me",
    "paypl",
    "skip e s c r o w",
    "skip escro",
    "skip the escrw",
    "pay me derectly",
    "pay me direcly",
    "p@y m3 d1r3ctly",
    "w1re 1t to m3",
    "$kip escr0w",
  ]) {
    assert.ok(blocked(probe), `expected blocked: ${probe}`);
    assert.equal(reason(probe), PAYMENT_BLOCK_MESSAGE, `expected escrow message: ${probe}`);
  }
});

test("letter-spaced and leetspeak payment attempts are flagged as evasion", () => {
  assert.ok(cats("z e l l e me").includes("evasion"));
  assert.ok(cats("p@y m3 d1r3ctly").includes("evasion"));
  assert.ok(!cats("pay me directly").includes("evasion"));
});

test("Escrow.com / shipmova.com named bare are fine; links and lookalikes are not", () => {
  assert.ok(!blocked("is escrow.com legit?"));
  assert.ok(!blocked("I read the FAQ on shipmova.com"));
  assert.ok(blocked("pay here: https://escrow.com/transaction/12345"));
  assert.ok(blocked("use escrowcom.xyz instead"));
  assert.ok(blocked("go to escrow.com.pay-now.co"));
  assert.ok(blocked("email me at support@escrow.com"));
  assert.ok(blocked("my site is sellerdeals.com"));
});

test("payment talk that stays on ShipMova / escrow still sends", () => {
  for (const msg of [
    "I can wire $45,000 once ShipMova confirms the deal.",
    "Can I pay into escrow today?",
    "When does Escrow.com release the money to you?",
    "I paid ShipMova's fee by bank transfer yesterday.",
    "Can I pay the ShipMova fee with Apple Pay?",
    "What's the best way to pay the reservation fee?",
    "Would you consider a different price if I pay the full fee?",
    "Please send me more photos of the engine.",
    "Send it to me when you get a chance — the service records, I mean.",
    "Is the car paid off, or is there a lien?",
    "I'll pay directly through escrow once the inspection passes.",
    "The price is $25,000 — can you do $24,000?",
    "Can you send the VIN again?",
    "Is the escrow fee included in the total?",
  ]) {
    assert.equal(scanForContactInfo(msg).ok, true, `expected clean: ${msg}`);
  }
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
    "any way we can do this off ShipMova?",
    "can we finish this privately to avoid the fee",
    "how do we close this without ShipMova taking a cut",
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
    "how do I contact ShipMova support?",
    "can we discuss the price a bit?",
    "does ShipMova connect us after payment?",
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
    "can we handle the sale without going through ShipMova",
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
    "The carfax is on a different site, I'll check it myself.",
    "Would you consider a different price if I pay the full fee?",
    "Let's continue once the inspection report is back.",
    "Can we keep talking about the trim options?",
    "different trim, same year — is that also available?",
    "I'll be reaching out through ShipMova support about the fee split.",
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

// Founder, 2026-10-09: block "pay me directly" messages — including how
// buyers and sellers in Nigeria, Ghana, Togo and Benin actually say it.
test("payment off ShipMova is blocked in English, Pidgin, French and local payment apps", () => {
  const blocked = [
    "pay me directly", "send the money to my account", "pay via zelle", "western union works", "pay in usdt",
    "sendwave is cheaper", "pay to my opay", "send to my palmpay", "my kuda account", "moniepoint transfer",
    "do transfer to my account", "make you send the money give me", "na me you go pay", "send am to my account",
    "payez-moi directement", "envoyez l'argent sur mon compte", "faites un virement sur mon compte",
    "paiement par mobile money", "envoie par MoMo", "orange money", "par wave", "moov money", "flooz",
    "je vous donne mon RIB", "payer en espèces", "on évite l'escrow", "pay half now outside",
    "deposit to hold it, send to me", "I can give you discount if you pay me outside the site",
  ];
  for (const m of blocked) {
    const r = scanForContactInfo(m);
    assert.equal(r.ok, false, m);
    assert.ok(r.categories.includes("payment_circumvention"), `${m}: ${r.categories.join(",")}`);
  }
});

test("ordinary chat in English, French and Pidgin still goes through", () => {
  const normal = [
    "Can you send me more photos of the engine?", "I'll send you the inspection time tomorrow",
    "I'll log into my account and reserve it", "I want to pay into escrow today", "Is there any rust outside?",
    "Can I see the car outside in daylight?", "My wallet is ready for the Escrow.com payment",
    "Bonjour, la voiture est-elle toujours disponible ?", "Pouvez-vous envoyer d'autres photos ?",
    "Je vais payer par Escrow.com", "Le prix est-il négociable ?", "Abeg the car still dey?",
    "Make you send more pictures abeg", "Thanks, I will wave goodbye to my old car soon",
    "Is the balance on the escrow fee shown before I pay?",
  ];
  for (const m of normal) assert.equal(scanForContactInfo(m).ok, true, m);
});
