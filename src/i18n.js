// Every word on screen comes from strings.js, so new languages need no code changes.

import { STRINGS } from './strings.js';

let lang = 'en';

export const getLang = () => lang;

export function setLang(next) {
  lang = STRINGS[next] ? next : 'en';
  document.documentElement.lang = lang === 'hi' ? 'hi-Latn' : 'en';
  applyStrings(document);
}

export function t(key, vars) {
  let s = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return s;
}

/** Fills elements marked with data-i18n (text) and data-i18n-label (aria-label). */
export function applyStrings(root) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-label]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nLabel));
    el.title = t(el.dataset.i18nLabel);
  });
}

/** The card text in the chosen language; own questions show as written. */
export function cardText(card) {
  if (!card) return '';
  if (card.text) return card.text;
  return (lang === 'hi' && card.hi) || card.en;
}
