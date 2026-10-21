// Shared by the game (on the phone) and the server function, so both refuse the same text.

export const LEVEL_KEYS = ['kids', 'friends', 'party', 'couples', 'spicy'];
export const TYPE_KEYS = ['truth', 'dare', 'would-you-rather', 'never-have-i-ever', 'most-likely-to'];
export const REPORT_REASONS = ['spicy', 'unsafe', 'mean', 'mistake'];
export const FEEDBACK_TOPICS = ['type', 'level', 'language', 'problem', 'other'];
export const MAX_QUESTION = 150;
export const MAX_NOTE = 200;

// Built-in card ids look like "ft012": level letter, type letter, 3 digits.
export const CARD_ID = /^[kfpcs][tdwnm]\d{3}$/;

const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const HANDLE = /(^|\s)@[\w.]{2,}/;
const LINK = /(https?:\/\/|www\.)|\b[\w-]+\.(com|in|net|org|io|app|me|co|ly|gg|xyz|link|site|online|info)\b/i;
// 8 or more digits, allowing spaces, dots, dashes and brackets between them.
const PHONE = /(?:\+?\d[\s().-]*){8,}/;

/** Returns null when the text is fine, or a reason key: 'contact', 'empty', 'long'. */
export function checkText(text, max) {
  const s = String(text ?? '').trim();
  if (s.length < 3) return 'empty';
  if (s.length > max) return 'long';
  if (EMAIL.test(s) || HANDLE.test(s) || LINK.test(s) || PHONE.test(s)) return 'contact';
  return null;
}

/** Collapses spaces and trims; keeps any language or script. */
export function cleanText(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}
