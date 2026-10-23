// Like / Dislike / Report, question suggestions and the feedback form.
// Everything waits in an outbox on the phone and is sent quietly when online.
// Never sent: player names, own questions that were not suggested, emails or device ids.

import { CONFIG } from './config.js';
import { load, save } from './store.js';
import { t } from './i18n.js';
import { h, sheet, toast, icon } from './ui.js';
import { CARD_ID, MAX_NOTE, REPORT_REASONS, FEEDBACK_TOPICS, checkText, cleanText } from '../shared/validate.js';
import { track } from './analytics.js';

let outbox = load('outbox', []);
let flushing = false;
let flushTimer;

const today = () => new Date().toISOString().slice(0, 10);

// Each send uses a little of the host's monthly allowance, so ratings are collected and sent
// together (every few minutes, or when the game is closed); suggestions and feedback go at once.
const SOON = 4000;
const LATER = 180_000;
const TEXT = new Set(['suggest', 'feedback']); // these go at once and may need the spam check
let flushAt = 0;

function queue(item) {
  outbox.push({ ...item, day: today() });
  if (outbox.length > 300) outbox = outbox.slice(-300);
  save('outbox', outbox);
  const small = outbox.filter((i) => !TEXT.has(i.k)).length;
  const wait = TEXT.has(item.k) || small >= 20 ? SOON : LATER;
  if (!flushAt || Date.now() + wait < flushAt) {
    clearTimeout(flushTimer);
    flushAt = Date.now() + wait;
    flushTimer = setTimeout(() => { flushAt = 0; flush(); }, wait);
  }
}

// ---------- Turnstile (free, invisible spam check), loaded only when needed ----------

let turnstileReady;
function loadTurnstile() {
  turnstileReady ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve(window.turnstile);
    s.onerror = () => { turnstileReady = null; reject(new Error('turnstile')); };
    document.head.append(s);
  });
  return turnstileReady;
}

async function turnstileToken() {
  const ts = await loadTurnstile();
  return new Promise((resolve, reject) => {
    const box = h('div', { class: 'ts-box' });
    document.body.append(box);
    const done = (fn) => (v) => { box.remove(); fn(v); };
    ts.render(box, {
      sitekey: CONFIG.turnstileSiteKey,
      appearance: 'interaction-only',
      callback: done(resolve),
      'error-callback': done(() => reject(new Error('turnstile'))),
      'timeout-callback': done(() => reject(new Error('turnstile'))),
    });
  });
}

/** Sends what is waiting. Ratings go without a token; text needs one when Turnstile is set up. */
export async function flush() {
  if (flushing || !outbox.length || !navigator.onLine) return;
  flushing = true;
  try {
    let items = outbox.slice(0, 50);
    let token = '';
    const hasText = items.some((i) => TEXT.has(i.k));
    if (hasText && CONFIG.turnstileSiteKey) {
      token = await turnstileToken().catch(() => '');
      if (!token) items = items.filter((i) => !TEXT.has(i.k));
    }
    if (!items.length) return;
    items.forEach((i) => { if (i.k === 'stats') i.sending = true; });
    const res = await fetch(CONFIG.api, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ v: CONFIG.version, token, items: items.map(({ sending, ...rest }) => rest) }),
      keepalive: true,
    });
    // 2xx: delivered. 400: the server will never accept these, so drop them too.
    if (res.ok || res.status === 400) {
      const sent = new Set(items);
      outbox = outbox.filter((i) => !sent.has(i));
      save('outbox', outbox);
    }
  } catch { /* offline or server down: try again later */ } finally {
    outbox.forEach((i) => { delete i.sending; });
    flushing = false;
  }
}

window.addEventListener('online', () => flush());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush();
});

// ---------- Visitor counts (for the owner's Visitors page) ----------
// One anonymous "visit" per phone per day, plus how many spins and cards were played that day.
// No id, name or address is sent: the server only adds numbers to the day's totals.

export function countVisit() {
  const day = today();
  if (load('visitDay', '') === day) return;
  const isNew = !load('seenBefore', false);
  save('visitDay', day);
  save('seenBefore', true);
  queue({ k: 'visit', new: isNew ? 1 : 0 });
}

export function countPlay(field) {
  const day = today();
  let it = outbox.find((i) => i.k === 'stats' && i.day === day && !i.sending);
  if (!it) {
    queue({ k: 'stats', spins: 0, cards: 0 });
    it = outbox[outbox.length - 1];
  }
  it[field] = Math.min(5000, (it[field] || 0) + 1);
  save('outbox', outbox);
}

// ---------- Ratings ----------

export function vote(card, kind, reason) {
  if (!CARD_ID.test(card.id || '')) return; // own questions stay on the phone
  queue({ k: 'vote', id: card.id, v: kind, ...(reason ? { r: reason } : {}) });
}

/** Opens the report reasons. Resolves with the reason, or null. */
export function reportSheet() {
  return new Promise((resolve) => {
    let picked = null;
    const s = sheet(t('reportTitle'), [
      h('p', { class: 'lead' }, t('reportLead')),
      h('div', { class: 'stack' }, REPORT_REASONS.map((r) =>
        h('button', { class: 'btn', type: 'button', onclick: () => { picked = r; s.close(); } }, t(`reason_${r}`)),
      )),
    ], { onClose: () => resolve(picked), className: 'small' });
  });
}

// ---------- Grown-up check (Kids & Family and Family mode) ----------

export function grownUpCheck() {
  return new Promise((resolve) => {
    const a = 3 + Math.floor(Math.random() * 7);
    const b = 3 + Math.floor(Math.random() * 7);
    let passed = false;
    const input = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', maxlength: 3, 'aria-label': t('grownUpAnswer') });
    const err = h('p', { class: 'error', 'aria-live': 'polite' });
    const s = sheet(t('grownUpTitle'), [
      h('p', { class: 'lead' }, t('grownUpLead')),
      h('form', {
        class: 'stack',
        onsubmit: (e) => {
          e.preventDefault();
          if (Number(input.value) === a * b) { passed = true; s.close(); } else err.textContent = t('grownUpWrong');
        },
      },
      h('label', { class: 'math' }, `${a} × ${b} = `, input),
      err,
      h('button', { class: 'btn primary', type: 'submit' }, t('continue'))),
    ], { onClose: () => resolve(passed), className: 'small' });
    setTimeout(() => input.focus(), 50);
  });
}

// ---------- Suggestions ----------

const recentSuggestions = () => load('suggestTimes', []).filter((x) => Date.now() - x < 3600e3);

/** Queues a suggestion. Returns null or an error key. */
export function suggest(q, lang) {
  const times = recentSuggestions();
  if (times.length >= 10) return 'tooMany';
  const text = cleanText(q.text);
  const bad = checkText(text, 150);
  if (bad) return bad;
  times.push(Date.now());
  save('suggestTimes', times);
  queue({ k: 'suggest', type: q.type, level: q.level, heat: q.heat || 0, text, lang });
  track('suggest');
  return null;
}

// ---------- Feedback form ----------

export function feedbackSheet({ needsGrownUp }) {
  let mood = 0;
  const topics = new Set();
  const note = h('textarea', { maxlength: MAX_NOTE, rows: 3, placeholder: t('fbNotePlaceholder'), 'aria-label': t('fbNote') });
  const count = h('small', { class: 'count' }, `0/${MAX_NOTE}`);
  note.addEventListener('input', () => { count.textContent = `${note.value.length}/${MAX_NOTE}`; });
  const trap = h('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', class: 'trap', 'aria-hidden': 'true' });
  const err = h('p', { class: 'error', 'aria-live': 'polite' });

  const faces = h('div', { class: 'faces', role: 'radiogroup', 'aria-label': t('fbMood') },
    [1, 2, 3, 4].map((m) => h('button', {
      type: 'button', role: 'radio', 'aria-checked': 'false', 'aria-label': t(`mood${m}`),
      onclick: (e) => {
        mood = m;
        faces.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', 'false'));
        e.currentTarget.setAttribute('aria-checked', 'true');
      },
    }, icon(`face${m}`, 'face'))),
  );

  const chips = h('div', { class: 'chips' }, FEEDBACK_TOPICS.map((k) => h('button', {
    type: 'button', class: 'chip', 'aria-pressed': 'false',
    onclick: (e) => {
      const b = e.currentTarget;
      if (topics.has(k)) topics.delete(k); else topics.add(k);
      b.setAttribute('aria-pressed', String(topics.has(k)));
    },
  }, t(`topic_${k}`))));

  const s = sheet(t('feedback'), [
    h('p', { class: 'lead' }, t('fbLead')),
    faces,
    h('p', { class: 'label' }, t('fbTopics')),
    chips,
    h('label', { class: 'field' }, h('span', { class: 'label' }, t('fbNote')), note, count),
    trap,
    err,
    h('button', {
      class: 'btn primary', type: 'button',
      onclick: async () => {
        if (trap.value) { s.close(); return; }
        if (!mood && !topics.size && !note.value.trim()) { err.textContent = t('fbEmpty'); return; }
        const text = cleanText(note.value);
        if (text) {
          const bad = checkText(text, MAX_NOTE);
          if (bad === 'contact') { err.textContent = t('errContact'); return; }
          if (needsGrownUp && !(await grownUpCheck())) return;
        }
        queue({ k: 'feedback', mood, topics: [...topics], note: text, lang: document.documentElement.lang });
        track('feedback');
        s.close();
        toast(t('fbThanks'));
      },
    }, t('send')),
    h('p', { class: 'fine' }, t('fbPrivacy', { email: CONFIG.contactEmail })),
  ]);
}
