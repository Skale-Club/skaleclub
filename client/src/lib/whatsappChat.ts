// Glue between the site's WhatsApp buttons and the WhatsApp-style chat that
// collects a name and a phone number before the handoff to wa.me
// (components/layout/WhatsAppChat.tsx, hosted by MobileActionBar).
//
// A button asks for the chat with `openWhatsAppChat`; when nothing claims the
// event (no host mounted, or this visitor already left their contact) the
// button's own wa.me link goes ahead as before.

export const WHATSAPP_CHAT_OPEN_EVENT = "whatsapp-chat:open";
export const WHATSAPP_CHAT_FORM = "whatsapp-chat";

/** Which button opened the chat; doubles as the analytics `location`. */
export type WhatsAppChatEntry = "floating_button" | "mobile_bar";

const STORAGE_KEY = "wa_chat_lead";
// After this long the visitor is asked again, in case the number changed.
const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;

/** True when this browser already left a name + phone through the chat. */
export function hasWhatsAppChatLead(): boolean {
  try {
    const at = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < REMEMBER_MS;
  } catch {
    return false;
  }
}

export function rememberWhatsAppChatLead() {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // Storage blocked: the visitor is simply asked again next time.
  }
}

/** Returns true when the chat took the click (the caller must not follow its link). */
export function openWhatsAppChat(entry: WhatsAppChatEntry): boolean {
  return !document.dispatchEvent(
    new CustomEvent<{ entry: WhatsAppChatEntry }>(WHATSAPP_CHAT_OPEN_EVENT, { cancelable: true, detail: { entry } }),
  );
}
