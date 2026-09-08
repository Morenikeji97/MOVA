/**
 * Shared contact-info / off-platform detector for the buyer <-> seller chat.
 *
 * This is the ONE place the blocking rules live. It is imported by the chat
 * server action (`app/chat/actions.ts`) for the hard, authoritative block and
 * by the chat composer for instant UX feedback — the two must never drift, so
 * neither side reimplements the rules.
 *
 * It runs at all times, regardless of reservation / payment state. There is no
 * toggle. A message that trips any rule is never delivered: the server stores
 * it as a `blocked_attempt` for admin monitoring and returns the matching
 * user-facing reason ({@link ContactInfoScan.message}) to the sender.
 *
 * What it blocks:
 *   - literal contact info: e-mail, phone (incl. spelled-out / broken-up /
 *     leetspeak digits), URLs / bare domains, social handles (with or without
 *     an "@")
 *   - physical meetups / street addresses
 *   - intent to move the deal off MOVA even with NO literal contact info —
 *     "can we talk somewhere else?", "can we skip the fee and deal directly?"
 *
 * Everything here is a HARD block. The only user-visible difference is which
 * short reason the sender sees (contact-info vs. off-platform intent), so a
 * tester can tell the two failure modes apart.
 *
 * Pure and dependency-free so it can be unit-tested in isolation
 * (`lib/chat-filter.test.ts`).
 */

/** Shown when the message contained (or structurally implied) literal contact info. */
export const CONTACT_INFO_BLOCK_MESSAGE =
  "Contact info can't be shared in chat — MOVA connects you directly after the deal is confirmed.";

/**
 * Shown when the message had no literal contact info but was angling to move
 * the deal off-platform / around the fee. Kept short, polite, and explains
 * *why* there is no need to arrange it here.
 */
export const CIRCUMVENTION_BLOCK_MESSAGE =
  "Let's keep this on MOVA — direct contact unlocks automatically once payment is confirmed, so there's no need to arrange it here.";

/** Machine-readable categories, handy for logging / spotting repeat patterns. */
export type ContactInfoCategory =
  | "email"
  | "phone"
  | "url"
  | "social_handle"
  | "circumvention_phrase" // literal "call me" / "my number is" / "dm me"
  | "circumvention_intent" // asking HOW to go off-platform / proposing it
  | "address" // physical meetup / street address
  | "evasion"; // a match only surfaced after de-leet / homoglyph folding

export interface ContactInfoScan {
  /** true when the message is clean and may be delivered. */
  ok: boolean;
  /** Every rule category that matched (empty when `ok`). */
  categories: ContactInfoCategory[];
  /** The user-facing reason to show the sender; null when `ok`. */
  message: string | null;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Fold common e-mail obfuscation ("name (at) gmail dot com", "john @ gmail .
 * com") back toward a plain form so the e-mail / domain patterns can see it.
 * Only ever used for matching — never shown or stored.
 */
function deobfuscate(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s*[([{]\s*at\s*[)\]}]\s*/g, "@")
    .replace(/\s*[([{]\s*dot\s*[)\]}]\s*/g, ".")
    .replace(
      /\b([a-z0-9._%+-]+)\s+at\s+([a-z0-9.-]+)\s+dot\s+([a-z]{2,})\b/g,
      "$1@$2.$3",
    )
    .replace(/\b([a-z0-9._%+-]+)\s+at\s+([a-z0-9-]+\.[a-z]{2,})\b/g, "$1@$2")
    .replace(/\s*@\s*/g, "@")
    .replace(/([a-z0-9])\s*\.\s*([a-z0-9])/g, "$1.$2");
}

// Cyrillic / Greek / full-width look-alikes -> ASCII. Small, curated set: enough
// to stop "саll mе" (Cyrillic) and "ｃａｌｌ" (full-width) sneaking a phrase past.
const HOMOGLYPHS: Record<string, string> = {
  а: "a", ә: "a", ɑ: "a", α: "a", "à": "a", "á": "a", "â": "a", "ä": "a",
  е: "e", ё: "e", є: "e", ε: "e", "é": "e", "è": "e", "ê": "e",
  о: "o", ο: "o", ө: "o", ø: "o", "ó": "o", "ò": "o", "ô": "o", "ö": "o",
  р: "p", ρ: "p",
  с: "c", ϲ: "c", ç: "c",
  х: "x", χ: "x",
  у: "y", ү: "y", γ: "y",
  к: "k", κ: "k",
  ѕ: "s",
  і: "i", ї: "i", ι: "i", "í": "i", "ì": "i",
  ј: "j",
  ԁ: "d",
  ո: "n", η: "n",
  м: "m", т: "t", τ: "t", в: "b", г: "r", н: "h",
  "＠": "@", "．": ".", "／": "/", "：": ":", "－": "-",
  "０": "0", "１": "1", "２": "2", "３": "3", "４": "4",
  "５": "5", "６": "6", "７": "7", "８": "8", "９": "9",
};

function homoglyphFold(s: string): string {
  let out = "";
  for (const ch of s) out += HOMOGLYPHS[ch] ?? ch;
  return out;
}

/**
 * Undo leetspeak / punctuation substitution ("c4ll", "t3xt m3", "wh@ts@pp",
 * "$kype") a *word at a time* — pure-digit / punctuation tokens are left alone
 * so real phone numbers and prices are untouched. "1" is ambiguous, so callers
 * get both an "i" and an "l" reading.
 */
function deLeet(s: string, oneAs: "i" | "l"): string {
  const map: Record<string, string> = {
    "4": "a", "@": "a", "3": "e", "1": oneAs, "!": "i", "|": "l",
    "0": "o", "5": "s", $: "s", "7": "t", "8": "b",
  };
  return s.replace(/\S+/g, (tok) =>
    /[a-z]/i.test(tok)
      ? tok.replace(/[4@31!|05$78]/g, (c) => map[c] ?? c)
      : tok,
  );
}

// ---------------------------------------------------------------------------
// Literal contact info: e-mail / URL / phone
// ---------------------------------------------------------------------------

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/i;

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s]+/i;

// Bare domains without a scheme — a curated TLD list keeps "etc." and version
// strings like "v2.0" from matching.
const BARE_DOMAIN_RE =
  /\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.(?:com|net|org|io|co|app|dev|xyz|info|biz|link|site|online|store|shop|me|tv|gg|ng|uk|us|ca|de|fr|ru|ly|to|tel)\b/i;

/** Spelled-out digit words: "four one five ...". */
const NUMBER_WORDS: Record<string, string> = {
  zero: "0", oh: "0", o: "0", nought: "0", one: "1", two: "2", three: "3",
  four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", niner: "9",
};
// Words allowed *between* digit words without breaking the run.
const DIGIT_FILLERS = new Set([
  "uh", "um", "er", "ah", "and", "then", "dash", "dot", "point", "comma", "like",
]);

/** ">= 7 digit words in a row" — "four one five five five five zero one three two". */
function hasSpelledOutNumber(text: string): boolean {
  const tokens = text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  let run = 0;
  let best = 0;
  for (const t of tokens) {
    if (t in NUMBER_WORDS) best = Math.max(best, ++run);
    else if (!DIGIT_FILLERS.has(t)) run = 0;
  }
  return best >= 7;
}

/**
 * Collapse "4-1-5 uh 5-5-5" style spacing so the phone scan can read it. Note
 * "." is deliberately NOT joined here — that would turn the price "45000.00"
 * into "4500000". Dotted numbers ("415.555.0132") are handled by the candidate
 * regex, whose own char class includes ".".
 */
function joinBrokenDigits(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b(?:uh|um|er|ah|like)\b/g, " ")
    .replace(/(\d)[\s\-/_]+(?=\d)/g, "$1");
}

// 6+ single digits each split by a separator: "4-1-5-5-5-5", "4 1 5 5 5 5 0".
const SPACED_DIGITS_RE = /\d(?:[\s.\-/_]\d){5,}/;

/** A price like "1,250,000" or "45000.00" — not a phone number. */
function looksLikeMoney(s: string): boolean {
  const t = s.trim();
  return /^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(t) || /^\d+\.\d{2}$/.test(t);
}

/**
 * 7-15 digits once separators are stripped, optionally with a leading "+".
 * Currency amounts ("$45,000", "₦1,250,000", "45000.00") are excluded so price
 * talk still works.
 */
function hasPhoneNumber(input: string): boolean {
  for (const text of [input, joinBrokenDigits(input)]) {
    if (SPACED_DIGITS_RE.test(text)) return true;
    const candidateRe = /\+?\d[\d\s().\-/]{5,}\d/g;
    let m: RegExpExecArray | null;
    while ((m = candidateRe.exec(text)) !== null) {
      const before = text.slice(Math.max(0, m.index - 2), m.index);
      if (/[$£€₦]\s?$/.test(before)) continue; // "$1 250 000"
      if (/(?:^|\s)[nN]$/.test(before)) continue; // "N1,200,000"
      if (looksLikeMoney(m[0])) continue;
      const digits = m[0].replace(/\D/g, "");
      if (digits.length >= 7 && digits.length <= 15) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Social handles (with and without "@")
// ---------------------------------------------------------------------------

const SOCIAL_HANDLE_RE = /(?:^|[^a-z0-9._%+-])@[a-z0-9._]{2,30}\b/i;

const PLATFORM_RE =
  /\b(?:whats\s?app|wa\.me|telegram|t\.me|signal|viber|we\s?chat|snap\s?chat|instagram|insta|\big\b|face\s?book|\bfb\b|messenger|discord|tik\s?tok|skype|kik|line\s?id|imo|reddit|threads)\b/i;

const PLATFORM_NAMES =
  "instagram|insta|ig|snapchat|snap|telegram|tg|tiktok|tik tok|twitter|facebook|fb|messenger|whatsapp|kik|discord|viber|wechat|skype|reddit|threads|bereal";

// Handle given without an "@": "my ig is johndoe123", "IG: jd_01",
// "find me on instagram username johndoe123", "insta johndoe123".
const HANDLE_NO_AT_RES: RegExp[] = [
  new RegExp(
    `\\b(?:my\\s+|the\\s+|on\\s+)?(?:${PLATFORM_NAMES})\\b\\s*(?:[:=,\\-]|\\bis\\b|\\bit'?s\\b|\\bare\\b|\\buser(?:name)?\\b|\\bhandle\\b|\\bid\\b|\\bname\\b)[\\s:=,\\-]*(?:(?:is|it'?s|handle|id|name)[\\s:=,\\-]*)?@?([a-z0-9][a-z0-9._]{1,31})\\b`,
    "i",
  ),
  new RegExp(
    `\\b(?:find|add|follow|dm|message|hit|catch|reach)\\s+me\\s+(?:on|at|@)?\\s*(?:${PLATFORM_NAMES})\\b[\\s:]*(?:user(?:name)?|handle|id|as|@)?\\s*@?([a-z0-9][a-z0-9._]{2,31})\\b`,
    "i",
  ),
  /\b(?:user\s?name|user\s?id|screen\s?name)\s+(?:is\s+|[:=]\s*)?@?([a-z0-9][a-z0-9._]{2,31})\b/i,
  // "handle" is a common word, so only when it's explicitly "handle is X" / "handle: X"
  /\b(?:my\s+)?handle\s+(?:is\s+|[:=]\s*)@?([a-z0-9][a-z0-9._]{2,31})\b/i,
  // platform immediately followed by a handle-shaped token (must carry a digit,
  // dot or underscore, so "insta stories" / "snap a photo" don't match)
  new RegExp(
    `\\b(?:${PLATFORM_NAMES})\\s+@?([a-z]*[0-9._][a-z0-9._]*)\\b`,
    "i",
  ),
];

// ---------------------------------------------------------------------------
// Literal contact-exchange phrases  ->  circumvention_phrase
// ---------------------------------------------------------------------------

const CONTACT_EXCHANGE_RES: RegExp[] = [
  // Verbs that unambiguously push a phone / messaging-app channel. "contact
  // you" / "reach you" / "message you" are deliberately NOT here — they overlap
  // with plain intent questions and are handled by isOffPlatformIntent.
  /\b(?:call|text|ring|whats\s?app|dm|hit|ping|buzz|holler)\s+(?:me|us|you)\b/i,
  /\b(?:reach|contact|find|add|message|text|call|ping)\s+me\s+(?:on|at|via|through)\b/i,
  /\b(?:my|your|his|her|their)\s+(?:number|digits|cell|mobile|phone|whats\s?app|email|e-?mail|contact|line|handle)\b/i,
  /\b(?:here'?s|here is|this is)\s+my\s+(?:number|email|e-?mail|cell|phone|contact|whats\s?app|handle)\b/i,
  /\b(?:give|send|share|drop|pass|shoot)\s+(?:me\s+)?your\s+(?:number|digits|contact|email|e-?mail|whats\s?app|line|handle)\b/i,
  /\b(?:what'?s|whats)\s+your\s+(?:number|cell|mobile|phone|whats\s?app|email|e-?mail|handle)\b/i,
  /\bhit\s+me\s+up\b/i,
];

// ---------------------------------------------------------------------------
// Off-platform intent  ->  circumvention_intent  (hard block, own message)
// ---------------------------------------------------------------------------

const INTENT_PHRASE_RES: RegExp[] = [
  // middleman / fee dodging
  /\bcut(?:ting)?\s+out\s+(?:the\s+)?middle\s?man\b/i,
  /\b(?:cut|skip|lose|drop|remove)\s+(?:the\s+)?middle\s?man\b/i,
  /\b(?:skip|avoid|dodge|bypass|save\s+on|get\s+around|get\s+past|beat|duck|escape)\s+(?:the\s+|mova'?s?\s+|that\s+|this\s+|your\s+|any\s+)?(?:fee|fees|commission|charge|charges|cut|markup|surcharge)\b/i,
  /\bwithout\s+(?:going\s+through\s+|dealing\s+with\s+|using\s+)?(?:mova|the\s+(?:app|platform|site|middleman|fee|commission))\b/i,
  /\bbehind\s+mova'?s?\s+back\b/i,
  /\bunder\s+the\s+table\b/i,
  /\bon\s+the\s+side\b/i,
  /\bkeep\s+it\s+between\s+us\b/i,
  /\bbetween\s+(?:you\s+and\s+me|just\s+us|us)\b/i,
  /\bany\s+chance\s+(?:we|you|i)\b[^.?!]{0,40}\b(?:directly|privately|between\s+us|off[-\s]?(?:app|platform|mova)|without\s+mova|outside)\b/i,
  // "not lose 8%", "rather not pay the fee", "save the 8 percent"
  /\b(?:rather\s+not|don'?t\s+want\s+to|do\s+not\s+want\s+to|hate\s+to|not\s+trying\s+to|not\s+keen\s+to|would\s+rather\s+not)\s+(?:lose|pay|give\s+up|eat|cover|part\s+with)\s+(?:the\s+)?(?:\d{1,2}\s*(?:%|percent|per\s?cent)|8|eight|fee|commission|cut)\b/i,
  /\b(?:not\s+lose|save|avoid\s+losing|keep|hold\s+onto)\s+(?:the\s+|that\s+|my\s+)?\d{1,2}\s*(?:%|percent|per\s?cent)\b/i,
  // "work something out directly / between us / on our own"
  /\bwork\s+(?:something|this|it|a\s+deal|things)\s+out\s+(?:directly|privately|between\s+us|off[-\s]?(?:app|platform|mova)|on\s+(?:our|the)\s+own|ourselves)\b/i,
  // "a quieter / private / different channel to talk / we could use"
  /\b(?:quiet(?:er)?|private|different|another|separate|alternative|other|second)\s+(?:channel|line)\b[^.?!]{0,25}\b(?:use|talk|chat|reach|message|contact)\b/i,
  /\b(?:use|talk\s+on|chat\s+on|switch\s+to)\b[^.?!]{0,15}\b(?:quiet(?:er)?|private|different|another|separate)\s+(?:channel|line)\b/i,
  // "off the platform / app / record / MOVA", "take this offline"
  /\boff[-\s]?(?:the\s+)?(?:platform|app|site|record|books|mova)\b/i,
  /\btake\s+(?:this|it|things?)\s+off(?:line|\s+platform|\s+the\s+app)\b/i,
  /\boutside\s+(?:of\s+)?(?:mova|this\s+(?:app|platform|site|chat)|the\s+(?:app|platform|site))\b/i,
  /\bnot\s+(?:on|through|via)\s+(?:mova|the\s+(?:app|platform|site))\b/i,
  // "move/switch this chat to another app / WhatsApp / email"
  /\b(?:move|switch|shift|take|bring|continue|carry|do)\s+(?:this|it|the)(?:\s+(?:chat|convo|conversation|discussion|deal|talk|thing|rest))?\s+(?:to|onto|over\s+to|on|into)\s+(?:a\s+)?(?:different|another|other|new|separate|whats\s?app|telegram|signal|email|text|sms|dm)\b/i,
  /\b(?:talk|chat|speak|continue)\s+(?:on|over|via|through)\s+(?:whats\s?app|telegram|signal|email|text|sms|another\s+app|a\s+different\s+app)\b/i,
  // "somewhere private / else to talk", "is there somewhere private"
  /\bsome\s?(?:where|place)\s+(?:private|more\s+private|else|off[-\s]?(?:app|platform))\b/i,
  /\b(?:continue|carry\s+on|keep\s+(?:this|talking|going)|pick\s+this\s+up|finish\s+this|talk)\b[^.?!]{0,30}\b(?:private(?:ly)?|elsewhere|somewhere\s+else|off[-\s]?(?:app|platform|mova))\b/i,
  // "what other ways can I reach / get in touch with you"
  /\bwhat\s+(?:other\s+)?ways?\b[^.?!]{0,40}\b(?:reach|contact|get\s+(?:in\s+touch|a?\s*hold)|message|talk\s+to)\b/i,
  /\b(?:other|another|a\s+different|some\s+other)\s+ways?\s+(?:can|could|to|for|i|we|of|that|we\s+could)\b[^.?!]{0,30}\b(?:reach|contact|get\s+(?:in\s+touch|a?\s*hold)|message|talk|close|finish|complete|handle|settle|sort|do|wrap\s+up)\s+(?:this|it|the\s+(?:deal|sale)|you)\b/i,
  /\bget\s+in\s+touch\s+with\s+you\b(?![^.?!]*\b(?:mova|support|team|here)\b)/i,
  // deal / buy / sell directly or privately (NOT "pay directly" — that's the
  // sanctioned MOVA flow: the buyer wires the seller for the car after the fee)
  /\b(?:deal|deals?|dealing|transact|do\s+business|trade)\s+(?:\w+\s+){0,2}(?:directly|direct|off[-\s]?(?:app|platform|site)|privately|1\s?on\s?1|one\s+on\s+one)\b/i,
  /\b(?:buy|buying|purchase|purchasing|sell|selling)\s+(?:\w+\s+){0,3}(?:directly|direct|off[-\s]?(?:app|platform|site)|privately|outside\s+(?:of\s+)?(?:the\s+)?(?:app|platform|site|mova|here))\b/i,
  // question forms angling for another channel
  /\bwhat(?:'?s| is)\s+(?:the\s+)?best\s+way\s+to\s+(?:reach|contact|get\s+(?:to|hold\s+of)|message|talk\s+to)\s+you\b/i,
  /\b(?:another|other|a\s+different|some\s+other)\s+way\s+(?:to|i\s+can|we\s+can|for\s+me\s+to)\s+(?:reach|contact|message|talk\s+to|get\s+(?:to|hold\s+of))\s+you\b/i,
  /\bis\s+there\s+(?:a|any|some)\s+(?:way|other\s+way)\s+(?:to|i\s+can|we\s+can)\s+(?:reach|contact|message|talk\s+to|get\s+(?:to|hold\s+of))\s+you\b/i,
  /\b(?:can|could|may)\s+(?:we|i|you)\s+(?:talk|chat|speak|connect|communicate|continue|deal|do\s+this)\s+(?:somewhere\s+else|elsewhere|off[-\s]?(?:app|platform)|privately|outside|offline|direct(?:ly)?)\b/i,
  /\bhow\s+(?:can|do|would|could|else\s+can)\s+(?:we|i)\s+(?:reach|contact|get\s+(?:to|hold\s+of)|message|talk\s+to)\s+you\b(?![^.?!]*\b(?:mova|support|team|help)\b)/i,
  /\bhow\s+(?:can|do|else\s+can)\s+(?:we|i)\s+(?:do|make|handle|close|finish)\s+this\s+(?:without|outside|off|privately)\b/i,
  /\b(?:do|have)\s+you\s+(?:have|got)\s+(?:another|a\s+different|other|any\s+other)\s+(?:way|number|contact|line|method|channel)\b/i,
  /\b(?:reach|contact|message|get\s+(?:to|hold\s+of)|talk\s+to)\s+you\s+(?:direct(?:ly)?|outside|off[-\s]?(?:app|platform)|privately)\b/i,
  /\bcan\s+we\s+(?:talk|chat|speak)\s+(?:somewhere\s+else|elsewhere)\b/i,
];

// Compositional backstop: (opener) + (comms verb) + (off-platform qualifier).
const Q_OPENER_RE =
  /\b(?:how|can\s+(?:we|i|you)|could\s+(?:we|i|you)|is\s+there|are\s+there|any\s+(?:way|other\s+way|chance)|what(?:'?s| is)?\s+(?:other\s+)?ways?|what(?:'?s| is)|do\s+you\s+have|would\s+it\s+be|is\s+it\s+possible|way\s+to)\b/i;
const COMMS_VERB_RE =
  /\b(?:contact|reach(?:\s+out)?|talk|speak|chat|message|msg|connect|communicate|continue|carry\s+on|keep\s+(?:this|talking)|get\s+in\s+touch|get\s+hold|link\s+up)\b/i;
const OFF_QUALIFIER_RE =
  /\b(?:outside|off[-\s]?(?:app|platform|site|here|mova)|directly|direct|elsewhere|somewhere\s+(?:else|private)|some\s?place\s+(?:else|private)|another\s+way|other\s+way|different\s+way|(?:different|another|other)\s+(?:app|platform|number)|privately|in\s+private|without\s+mova|not\s+(?:here|on\s+mova|through\s+mova)|offline|on\s+the\s+side)\b/i;
const STRONG_OFF_RE =
  /\b(?:outside|off[-\s]?(?:app|platform|site|mova)|privately|somewhere\s+(?:else|private)|another\s+way|(?:different|another)\s+(?:app|platform)|without\s+mova|on\s+the\s+side|offline)\b/i;

function isOffPlatformIntent(text: string): boolean {
  if (INTENT_PHRASE_RES.some((re) => re.test(text))) return true;
  if (Q_OPENER_RE.test(text) && COMMS_VERB_RE.test(text) && OFF_QUALIFIER_RE.test(text)) {
    return true;
  }
  if (COMMS_VERB_RE.test(text) && STRONG_OFF_RE.test(text)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Physical meetup / address  ->  address
// ---------------------------------------------------------------------------

const ADDRESS_RES: RegExp[] = [
  // "meet me at the / my / your <place>" — needs an owner word + a noun so
  // "meet me at 5" / "see me on Tuesday" don't match.
  /\bmeet\s+(?:me|you|up)?\s*(?:at|near|outside|behind|by|in\s+front\s+of)\s+(?:the|my|your|a)\s+[a-z]/i,
  /\bmeet(?:\s+up)?\s+(?:in\s+person|irl|face\s+to\s+face)\b/i,
  /\bin\s+person\b/i,
  /\bface\s+to\s+face\b/i,
  /\bcome\s+(?:to|by|over|round|down)\b/i,
  // "come see IT / the car" (a viewing), not "come see what I mean in the pic"
  /\bcome\s+(?:and\s+)?(?:see|look\s+at|view|inspect|check\s+out|test\s?drive|drive|grab|collect)\s+(?:it|this|the\s+(?:car|truck|suv|vehicle|ride|whip))\b/i,
  /\b(?:stop|swing|pass|roll|slide|pull)\s+(?:by|up|through)\b/i,
  /\b(?:drive|head|come)\s+(?:over|out|down|up|round)\s+(?:to\s+(?:you|your|see|check|look|meet|grab|get)|and\s+(?:see|look|check|meet|grab|get|inspect)|this\s+(?:weekend|week|evening)|tomorrow|today|tonight)\b/i,
  /\bbring\s+(?:it|that|the\s+(?:car|vehicle|truck|suv))\s+(?:to|by|over|round|down)\b/i,
  /\b(?:your|my)\s+(?:driveway|garage|showroom|dealership|lot|yard|shop|office|address|location)\b/i,
  /\b(?:my|our|the)\s+(?:dealership|lot|garage|showroom|shop|yard)\b[^.?!]*\b(?:is\s+(?:at|on)|located|come\s+by)\b/i,
  /\b(?:address|location)\s*(?:is|:|=)\s*\S/i,
  /\bwhere\s+are\s+you\s+(?:located|based|at)\b/i,
  /\bwhat(?:'?s| is)\s+your\s+(?:address|location)\b/i,
  /\bsend\s+(?:me\s+)?(?:your|the)\s+(?:street\s+|home\s+|full\s+)?address\b(?![^.?!]*\bmova\b)/i,
  /\bcome\s+(?:get|pick)\s+it\b/i,
  /\bpick(?:\s*it)?\s*up\s+(?:at|from\s+my|in\s+person)\b/i,
];

const STREET_RE =
  /\b\d{1,6}\s+(?:[nsew]\.?\s+)?(?:[a-z0-9.'-]+\s+){0,3}(?:street|avenue|ave|boulevard|blvd|road|lane|drive|court|circle|terrace|highway|hwy|parkway|pkwy|square|trail|\bst\b|\brd\b|\bln\b|\bdr\b|\bct\b|\bcir\b|\bpl\b|\bsq\b)\b\.?/i;

const CITY_STATE_ZIP_RE =
  /\b[a-z][a-z.\- ]{1,30},\s*[a-z]{2}\s+\d{5}(?:-\d{4})?\b/i;

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

const STRUCTURAL: ContactInfoCategory[] = [
  "email",
  "phone",
  "url",
  "social_handle",
  "address",
  "circumvention_phrase",
];

function blockMessageFor(categories: ContactInfoCategory[]): string | null {
  if (categories.length === 0) return null;
  if (categories.some((c) => STRUCTURAL.includes(c))) {
    return CONTACT_INFO_BLOCK_MESSAGE;
  }
  return CIRCUMVENTION_BLOCK_MESSAGE;
}

/** Word-based categories for one already-normalized string. */
function wordCategories(text: string): Set<ContactInfoCategory> {
  const found = new Set<ContactInfoCategory>();
  if (
    SOCIAL_HANDLE_RE.test(text) ||
    PLATFORM_RE.test(text) ||
    HANDLE_NO_AT_RES.some((re) => re.test(text))
  ) {
    found.add("social_handle");
  }
  if (CONTACT_EXCHANGE_RES.some((re) => re.test(text))) {
    found.add("circumvention_phrase");
  }
  if (isOffPlatformIntent(text)) found.add("circumvention_intent");
  if (ADDRESS_RES.some((re) => re.test(text)) || STREET_RE.test(text) || CITY_STATE_ZIP_RE.test(text)) {
    found.add("address");
  }
  return found;
}

/**
 * Scan a chat message. `ok: false` means it must not be delivered; `message`
 * is the reason to show the sender.
 */
export function scanForContactInfo(message: string): ContactInfoScan {
  const raw = typeof message === "string" ? message : "";
  const lower = raw.toLowerCase();
  const norm = homoglyphFold(lower);
  const leetTexts = [deLeet(norm, "i"), deLeet(norm, "l")];

  const categories = new Set<ContactInfoCategory>();
  let evaded = false;

  // --- e-mail ---
  const emailPlain = EMAIL_RE.test(raw) || EMAIL_RE.test(deobfuscate(raw));
  const emailFolded = EMAIL_RE.test(norm) || EMAIL_RE.test(deobfuscate(norm));
  if (emailPlain || emailFolded) {
    categories.add("email");
    if (emailFolded && !emailPlain) evaded = true;
  }

  // --- phone ---
  const phonePlain = hasPhoneNumber(raw);
  const phoneDerived =
    hasPhoneNumber(norm) || hasSpelledOutNumber(norm) || hasSpelledOutNumber(raw);
  if (phonePlain || phoneDerived) {
    categories.add("phone");
    if (phoneDerived && !phonePlain) evaded = true;
  }

  // --- url / bare domain ---
  if (
    URL_RE.test(raw) ||
    URL_RE.test(norm) ||
    BARE_DOMAIN_RE.test(deobfuscate(raw)) ||
    BARE_DOMAIN_RE.test(deobfuscate(norm)) ||
    ((BARE_DOMAIN_RE.test(raw) || BARE_DOMAIN_RE.test(norm)) && !categories.has("email"))
  ) {
    categories.add("url");
  }

  // --- word-based categories ---
  // `lower` is the honest baseline; anything that only shows up after homoglyph
  // folding or de-leeting is also flagged as a deliberate `evasion` attempt.
  const baseline = wordCategories(lower);
  for (const c of baseline) categories.add(c);
  for (const text of [norm, ...leetTexts]) {
    for (const c of wordCategories(text)) {
      if (!categories.has(c)) categories.add(c);
      if (!baseline.has(c)) evaded = true;
    }
  }

  if (evaded && categories.size > 0) categories.add("evasion");

  const list = [...categories];
  return { ok: list.length === 0, categories: list, message: blockMessageFor(list) };
}
