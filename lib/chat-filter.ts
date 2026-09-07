/**
 * Shared contact-info detector for the buyer <-> seller chat.
 *
 * This is the ONE place the blocking rules live. It is imported by the chat
 * server action (`app/chat/actions.ts`) for the hard, authoritative block and
 * by the chat composer for instant UX feedback — the two must never drift, so
 * neither side reimplements the rules.
 *
 * It runs at all times, regardless of reservation / payment state. There is no
 * toggle. A message that trips any rule is never delivered: the server stores
 * it as a `blocked_attempt` for admin monitoring and returns
 * {@link CONTACT_INFO_BLOCK_MESSAGE} to the sender.
 *
 * Pure and dependency-free so it can be unit-tested in isolation
 * (`lib/chat-filter.test.ts`).
 */

/** The single inline reason shown to a sender whose message was blocked. */
export const CONTACT_INFO_BLOCK_MESSAGE =
  "Contact info can't be shared in chat — MOVA connects you directly after the deal is confirmed.";

/** Machine-readable categories, handy for logging / spotting repeat patterns. */
export type ContactInfoCategory =
  | "email"
  | "phone"
  | "url"
  | "social_handle"
  | "circumvention_phrase";

export interface ContactInfoScan {
  /** true when the message is clean and may be delivered. */
  ok: boolean;
  /** Every rule category that matched (empty when `ok`). */
  categories: ContactInfoCategory[];
}

/**
 * Fold common obfuscation ("name (at) gmail dot com", "john @ gmail . com")
 * back toward a plain form so the e-mail / URL patterns below can see it.
 * Only ever used for matching — never shown to a user or stored.
 */
function deobfuscate(input: string): string {
  return (
    input
      .toLowerCase()
      // Bracketed spell-outs anywhere: "(at)" -> "@", "[dot]" -> "."
      .replace(/\s*[([{]\s*at\s*[)\]}]\s*/g, "@")
      .replace(/\s*[([{]\s*dot\s*[)\]}]\s*/g, ".")
      // Spelled-out e-mail: "name at gmail dot com" -> "name@gmail.com".
      // Anchored on the "<local> at <host> dot <tld>" shape so ordinary
      // sentences ("let's chat at noon") are left alone.
      .replace(
        /\b([a-z0-9._%+-]+)\s+at\s+([a-z0-9.-]+)\s+dot\s+([a-z]{2,})\b/g,
        "$1@$2.$3",
      )
      // "name at gmail.com" (only "at" spelled out) -> "name@gmail.com"
      .replace(
        /\b([a-z0-9._%+-]+)\s+at\s+([a-z0-9-]+\.[a-z]{2,})\b/g,
        "$1@$2",
      )
      // collapse spaces hugging an @ or .  ("john @ gmail . com")
      .replace(/\s*@\s*/g, "@")
      .replace(/([a-z0-9])\s*\.\s*([a-z0-9])/g, "$1.$2")
  );
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/i;

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s]+/i;

// Bare domains without a scheme — a curated TLD list keeps "etc." and version
// strings like "v2.0" from matching.
const BARE_DOMAIN_RE =
  /\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.(?:com|net|org|io|co|app|dev|xyz|info|biz|link|site|online|store|shop|me|tv|gg|ng|uk|us|ca|de|fr|ru|ng|ly|to|tel)\b/i;

// An @handle that is not the local part of an e-mail (not preceded by a word
// character) — "@johndoe", "dm @john_doe".
const SOCIAL_HANDLE_RE = /(?:^|[^a-z0-9._%+-])@[a-z0-9._]{2,30}\b/i;

const PLATFORM_RE =
  /\b(?:whats\s?app|wa\.me|telegram|t\.me|signal|viber|wechat|we\s?chat|snapchat|snap\s?chat|instagram|insta|\big\b|facebook|\bfb\b|messenger|skype|kik|line\s?id|imo)\b/i;

const CIRCUMVENTION_RES: RegExp[] = [
  // "call me", "text me", "whatsapp me", "dm me", "reach us", "hit me up"
  /\b(?:call|text|ring|whats\s?app|message|msg|dm|reach|contact|email|e-?mail|hit)\s+(?:me|us|you)\b/i,
  // "reach me on", "contact me at", "find me via"
  /\b(?:reach|contact|find|add|message|text|call|ping)\s+me\s+(?:on|at|via|through)\b/i,
  // "my number", "your whatsapp", "his cell", "my e-mail"
  /\b(?:my|your|his|her|their)\s+(?:number|digits|cell|mobile|phone|whats\s?app|email|e-?mail|contact|line|handle)\b/i,
  // "here's my number", "this is my email"
  /\b(?:here'?s|here is|this is)\s+my\s+(?:number|email|e-?mail|cell|phone|contact|whats\s?app)\b/i,
  // "give me your number", "send your contact", "share your number"
  /\b(?:give|send|share|drop|pass)\s+(?:me\s+)?your\s+(?:number|digits|contact|email|e-?mail|whats\s?app|line)\b/i,
  // going around the platform
  /\boff[-\s]?platform\b/i,
  /\boutside(?:\s+of)?\s+mova\b/i,
  /\bnot\s+on\s+mova\b/i,
  /\bgoogle\s+(?:hangout|meet|chat|voice)\b/i,
];

// A run that looks like a phone number: 7-15 digits once separators are
// stripped, optionally with a leading "+". Currency amounts ("$45,000",
// "N1,250,000") are excluded so price talk still works.
function hasPhoneNumber(raw: string): boolean {
  const candidateRe = /\+?\d[\d\s().\-]{5,}\d/g;
  let m: RegExpExecArray | null;
  while ((m = candidateRe.exec(raw)) !== null) {
    const start = m.index;
    const prevChar = raw.slice(Math.max(0, start - 1), start);
    // Skip money: "$1,250,000", "£12345", "₦900000", "N1,200,000"
    if (/[$£€₦]/.test(prevChar)) continue;
    if (/(?:^|\s)[nN]$/.test(raw.slice(Math.max(0, start - 2), start))) continue;
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 15) return true;
  }
  return false;
}

/**
 * Scan a chat message for contact info / attempts to move the conversation off
 * MOVA. `ok: false` means it must not be delivered.
 */
export function scanForContactInfo(message: string): ContactInfoScan {
  const raw = typeof message === "string" ? message : "";
  const folded = deobfuscate(raw);
  const categories: ContactInfoCategory[] = [];

  if (EMAIL_RE.test(raw) || EMAIL_RE.test(folded)) categories.push("email");

  if (hasPhoneNumber(raw)) categories.push("phone");

  if (
    URL_RE.test(raw) ||
    BARE_DOMAIN_RE.test(folded) ||
    (BARE_DOMAIN_RE.test(raw) && !categories.includes("email"))
  ) {
    categories.push("url");
  }

  if (SOCIAL_HANDLE_RE.test(raw) || PLATFORM_RE.test(raw)) {
    categories.push("social_handle");
  }

  if (CIRCUMVENTION_RES.some((re) => re.test(raw))) {
    categories.push("circumvention_phrase");
  }

  // De-dupe while keeping first-seen order.
  const unique = [...new Set(categories)];
  return { ok: unique.length === 0, categories: unique };
}
