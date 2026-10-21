// POST /api/batch: ratings, suggestions and feedback sent from the game, saved in Netlify Blobs.
// Stores no names, emails or IP addresses. Text items need a Turnstile token when
// TURNSTILE_SECRET is set (optional); the IP address is never passed on or stored.
//
// Storage keys:  s/pending/<id>  suggestions waiting for review
//                f/new/<id>      feedback not yet read
//                v/e/<id>        one batch of ratings (merged into v/summary by the review page)
//                l/<kind>/<hour> hourly totals for the whole game (spam brake)

import {
  CARD_ID, LEVEL_KEYS, TYPE_KEYS, REPORT_REASONS, FEEDBACK_TOPICS, MAX_QUESTION, MAX_NOTE,
  checkText, cleanText,
} from '../shared/validate.js';

// Totals per hour for the whole game; above these we answer "busy" and the phone retries later.
export const HOURLY = { suggest: 300, feedback: 300 };
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const REASON_FIELD = { spicy: 'r_spicy', unsafe: 'r_unsafe', mean: 'r_mean', mistake: 'r_mistake' };

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

async function verifyTurnstile(token, secret) {
  if (!token || typeof token !== 'string') return false;
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    return (await res.json()).success === true;
  } catch {
    return false;
  }
}

const day = (it) => (DAY.test(it.day) ? it.day : null);
const lang = (it) => String(it.lang || '').slice(0, 10);

/** Checks one item from the phone. Returns { kind, data } or null. */
export function parseItem(it) {
  if (!it || typeof it !== 'object') return null;

  if (it.k === 'vote') {
    if (!CARD_ID.test(it.id || '')) return null;
    if (it.v === 'like') return { kind: 'vote', data: { id: it.id, field: 'likes' } };
    if (it.v === 'dislike') return { kind: 'vote', data: { id: it.id, field: 'dislikes' } };
    if (it.v === 'report' && REPORT_REASONS.includes(it.r)) return { kind: 'vote', data: { id: it.id, field: REASON_FIELD[it.r] } };
    return null;
  }

  if (it.k === 'suggest') {
    const text = cleanText(it.text);
    const heat = Number(it.heat) || 0;
    if (!TYPE_KEYS.includes(it.type) || !LEVEL_KEYS.includes(it.level)) return null;
    if (![0, 1, 2, 3].includes(heat) || checkText(text, MAX_QUESTION)) return null;
    return { kind: 'suggest', data: { day: day(it), type: it.type, level: it.level, heat, lang: lang(it), text } };
  }

  if (it.k === 'feedback') {
    const mood = Number(it.mood) || 0;
    const topics = Array.isArray(it.topics) ? [...new Set(it.topics.filter((x) => FEEDBACK_TOPICS.includes(x)))] : [];
    const note = cleanText(it.note).slice(0, MAX_NOTE);
    if (mood < 0 || mood > 4) return null;
    if (note && checkText(note, MAX_NOTE) === 'contact') return null;
    if (!mood && !topics.length && !note) return null;
    return { kind: 'feedback', data: { day: day(it), mood, topics, note, lang: lang(it) } };
  }

  return null;
}

/** Adds ratings into a { cardId: { likes, dislikes, r_* } } map. */
export function addVotes(map, votes) {
  for (const [id, counts] of Object.entries(votes)) {
    const row = (map[id] ||= {});
    for (const [field, n] of Object.entries(counts)) row[field] = (row[field] || 0) + n;
  }
  return map;
}

export async function handleBatch(request, { store, env = {}, now = new Date() }) {
  if (request.method !== 'POST') return json({ error: 'use POST' }, 405);
  if (Number(request.headers.get('content-length') || 0) > 64_000) return json({ error: 'too large' }, 413);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  const items = Array.isArray(body?.items) ? body.items.slice(0, 100) : null;
  if (!items?.length) return json({ error: 'no items' }, 400);
  const version = String(body.v || '').slice(0, 20);

  const hasText = items.some((i) => i?.k === 'suggest' || i?.k === 'feedback');
  if (hasText && env.TURNSTILE_SECRET && !(await verifyTurnstile(body.token, env.TURNSTILE_SECRET))) {
    return json({ error: 'spam check failed' }, 403);
  }

  const votes = {};
  const texts = [];
  for (const it of items) {
    const parsed = parseItem(it);
    if (!parsed) continue;
    if (parsed.kind === 'vote') addVotes(votes, { [parsed.data.id]: { [parsed.data.field]: 1 } });
    else texts.push(parsed);
  }
  const voteCount = Object.values(votes).reduce((n, row) => n + Object.values(row).reduce((a, b) => a + b, 0), 0);
  const saved = voteCount + texts.length;
  if (!saved) return json({ error: 'nothing valid' }, 400);

  const hour = now.toISOString().slice(0, 13);
  for (const kind of Object.keys(HOURLY)) {
    const n = texts.filter((x) => x.kind === kind).length;
    if (!n) continue;
    const key = `l/${kind}/${hour}`;
    const total = ((await store.get(key, { type: 'json' }))?.n || 0) + n;
    if (total > HOURLY[kind]) return json({ error: 'busy' }, 429);
    await store.setJSON(key, { n: total });
  }

  const created = now.toISOString();
  const writes = texts.map((x) => store.setJSON(
    `${x.kind === 'suggest' ? 's/pending' : 'f/new'}/${newId()}`,
    { ...x.data, created, version },
  ));
  if (voteCount) writes.push(store.setJSON(`v/e/${newId()}`, votes));
  await Promise.all(writes);
  return json({ ok: true, saved, skipped: items.length - saved });
}
