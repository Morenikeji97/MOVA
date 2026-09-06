/**
 * Config for the floating WhatsApp contact button (components/ui/whatsapp-button).
 *
 * Both values are overridable per environment without a code change:
 *   NEXT_PUBLIC_WHATSAPP_NUMBER  — E.164 digits only, no "+", spaces or dashes
 *                                  (e.g. 2348012345678). wa.me needs it bare.
 *   NEXT_PUBLIC_WHATSAPP_MESSAGE — text pre-filled in the chat composer.
 *
 * The constants below are the fallbacks used when those env vars are unset.
 * Set NEXT_PUBLIC_WHATSAPP_NUMBER to an empty string to hide the button.
 */
const DEFAULT_WHATSAPP_NUMBER = "16316173816";
const DEFAULT_WHATSAPP_MESSAGE = "Hi, I have a question about MOVA";

/** Digits only — wa.me rejects "+", spaces and dashes. */
export const WHATSAPP_NUMBER = (
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? DEFAULT_WHATSAPP_NUMBER
).replace(/\D/g, "");

export const WHATSAPP_MESSAGE =
  process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE ?? DEFAULT_WHATSAPP_MESSAGE;

/**
 * `https://wa.me/<number>?text=<encoded message>`, or `null` when no number is
 * configured (so the button can render nothing rather than a broken link).
 */
export function whatsappLink(): string | null {
  if (!WHATSAPP_NUMBER) return null;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
}
