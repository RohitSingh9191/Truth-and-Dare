// /admin: the owner's review page, protected by ADMIN_PASSWORD, and by ADMIN_USER when that is
// set (otherwise any user name works).
//   /admin            suggestions waiting for review (approve, edit or reject)
//   /admin/approved   approved suggestions, ready to copy into content/questions/
//   /admin/feedback   feedback messages
//   /admin/cards      likes, dislikes and reports per built-in card

import { addVotes } from './api.js';

const LEVELS = ['kids', 'friends', 'party', 'couples', 'spicy'];
const TYPES = ['truth', 'dare', 'would-you-rather', 'never-have-i-ever', 'most-likely-to'];
const MOODS = ['', '☹️', '😐', '🙂', '😍'];
const ID = /^[a-z0-9-]{3,40}$/;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function safeEqual(a, b) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let r = 0;
  for (let i = 0; i < x.length; i++) r |= x[i] ^ y[i];
  return r === 0;
}

function authorised(request, password, user) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Basic ')) return false;
  try {
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(header.slice(6)), (c) => c.charCodeAt(0)));
    const split = decoded.indexOf(':');
    const nameOk = !user || safeEqual(decoded.slice(0, split), user);
    const passOk = safeEqual(decoded.slice(split + 1), password);
    return nameOk && passOk;
  } catch {
    return false;
  }
}

const HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'x-frame-options': 'DENY',
  'x-robots-tag': 'noindex',
  'content-security-policy': "default-src 'self'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
};

function page(title, active, body) {
  const tab = (href, label) => `<a href="${href}"${active === href ? ' class="on"' : ''}>${label}</a>`;
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} · TruthSpin admin</title>
<style>
body{margin:0;font:16px/1.5 system-ui,sans-serif;background:#f6f3ff;color:#1b1638}
main{max-width:900px;margin:0 auto;padding:16px}
h1{font-size:1.4em}
nav{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px}
nav a{padding:10px 14px;border-radius:999px;background:#fff;color:#1b1638;text-decoration:none;border:1px solid #ddd}
nav a.on{background:#1b1638;color:#fff}
.item{background:#fff;border:1px solid #e3def5;border-radius:12px;padding:12px;margin:10px 0}
.meta{color:#5d5683;font-size:13px}
textarea{width:100%;box-sizing:border-box;font:inherit;padding:8px;border-radius:8px;border:1px solid #ccc}
select,button{font:inherit;padding:10px 12px;border-radius:8px;border:1px solid #ccc;background:#fff;min-height:44px}
button.ok{background:#127a4a;color:#fff;border:0}button.no{background:#b3261e;color:#fff;border:0}
.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;background:#fff;min-width:560px}
td,th{border-bottom:1px solid #eee;padding:6px;text-align:left;vertical-align:top}
.flag{background:#fff0ef}pre{white-space:pre-wrap;background:#fff;border:1px solid #ddd;padding:12px;border-radius:8px}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}
</style></head><body><main>
<h1>${esc(title)}</h1>
<nav>${tab('/admin', 'Suggestions')}${tab('/admin/approved', 'Approved')}${tab('/admin/feedback', 'Feedback')}${tab('/admin/cards', 'Card ratings')}</nav>
${body}</main></body></html>`, { headers: HEADERS });
}

const options = (list, value) => list.map((v) => `<option${v === value ? ' selected' : ''}>${v}</option>`).join('');

/** Reads every entry under a prefix as { id, ...value }, newest first. */
async function readAll(store, prefix, limit = 300) {
  const { blobs } = await store.list({ prefix });
  const keys = blobs.map((b) => b.key).sort().reverse().slice(0, limit);
  const values = await Promise.all(keys.map((k) => store.get(k, { type: 'json' })));
  return keys.map((k, i) => (values[i] ? { id: k.slice(prefix.length), ...values[i] } : null)).filter(Boolean);
}

async function move(store, from, to, changes = {}) {
  const value = await store.get(from, { type: 'json' });
  if (!value) return false;
  await store.setJSON(to, { ...value, ...changes });
  await store.delete(from);
  return true;
}

async function suggestionsPage(store) {
  const list = (await readAll(store, 's/pending/', 100)).reverse();
  const items = list.map((s) => `<form class="item" method="post" action="/admin/suggestion">
<input type="hidden" name="id" value="${esc(s.id)}">
<div class="meta">${esc(s.day || s.created?.slice(0, 10))} · ${esc(s.lang)} · v${esc(s.version)}</div>
<textarea name="text" rows="2" maxlength="150">${esc(s.text)}</textarea>
<div class="row">
<select name="type">${options(TYPES, s.type)}</select>
<select name="level">${options(LEVELS, s.level)}</select>
<label>Heat (18+ only) <select name="heat">${options(['0', '1', '2', '3'], String(s.heat))}</select></label>
<button class="ok" name="action" value="approve">Approve</button>
<button class="no" name="action" value="reject">Reject</button>
</div></form>`).join('');
  return page('Suggestions to check', '/admin', `
<p>Check each one: nothing dangerous, no real names, nothing sexual below 18+, no alcohol or romance in Kids &amp; Family. Edit the text if needed. Heat is only for couples and spicy (1 to 3).</p>
${items || '<p>Nothing waiting. 🎉</p>'}`);
}

async function approvedPage(store) {
  const list = await readAll(store, 's/approved/');
  const out = {};
  for (const s of list.sort((a, b) => (a.level + a.type).localeCompare(b.level + b.type))) {
    (out[s.level] ||= []).push({ type: s.type, ...(s.heat ? { heat: s.heat } : {}), en: s.text, hi: '' });
  }
  return page('Approved, ready to add', '/admin/approved', `
<p>Copy these into <code>content/questions/&lt;level&gt;.json</code>, give each a new id (next free number) and a Hinglish line, then push the update. After that, tap “Mark all as added”.</p>
<pre>${esc(JSON.stringify(out, null, 2))}</pre>
<form method="post" action="/admin/added"><button class="ok">Mark all as added</button></form>`);
}

async function feedbackPage(store) {
  const unread = await readAll(store, 'f/new/', 200);
  const read = await readAll(store, 'f/read/', 100);
  const card = (f, done) => `<div class="item"${done ? ' style="opacity:.55"' : ''}>
<div class="meta">${esc(f.day || f.created?.slice(0, 10))} · ${esc(f.lang)} · v${esc(f.version)}</div>
<div style="font-size:22px">${MOODS[f.mood] || ''}</div>
${f.topics?.length ? `<div class="meta">About: ${esc(f.topics.join(', '))}</div>` : ''}
${f.note ? `<p>${esc(f.note)}</p>` : ''}
${done ? '' : `<form method="post" action="/admin/feedback-done"><input type="hidden" name="id" value="${esc(f.id)}"><button>Mark as read</button></form>`}
</div>`;
  const body = unread.map((f) => card(f, false)).join('') + read.map((f) => card(f, true)).join('');
  return page('Feedback', '/admin/feedback', body || '<p>No feedback yet.</p>');
}

/** Merges new rating batches into one summary, then deletes the merged batches. */
async function compactVotes(store) {
  const summary = (await store.get('v/summary', { type: 'json' })) || {};
  const { blobs } = await store.list({ prefix: 'v/e/' });
  const keys = blobs.map((b) => b.key);
  const batches = await Promise.all(keys.map((k) => store.get(k, { type: 'json' })));
  batches.forEach((b) => b && addVotes(summary, b));
  if (keys.length) {
    await store.setJSON('v/summary', summary);
    await Promise.all(keys.map((k) => store.delete(k)));
  }
  return summary;
}

async function cardsPage(store, loadCards) {
  const texts = {};
  await Promise.all(LEVELS.map(async (l) => {
    try { for (const c of await loadCards(l)) texts[c.id] = c.en; } catch { /* text is optional */ }
  }));
  const summary = await compactVotes(store);
  const rows = Object.entries(summary).map(([card, v]) => {
    const n = (k) => v[k] || 0;
    return { card, ...v, serious: n('r_spicy') + n('r_unsafe'), bad: n('dislikes') + n('r_spicy') + n('r_unsafe') + n('r_mean') + n('r_mistake'), likes: n('likes') };
  }).sort((a, b) => b.serious - a.serious || b.bad - a.bad || b.likes - a.likes).slice(0, 300);
  const cell = (v) => `<td>${v || 0}</td>`;
  const html = rows.map((r) => `<tr${r.serious >= 3 ? ' class="flag"' : ''}>
<td>${esc(r.card)}</td><td>${esc(texts[r.card] || '')}</td>${cell(r.likes)}${cell(r.dislikes)}${cell(r.r_spicy)}${cell(r.r_unsafe)}${cell(r.r_mean)}${cell(r.r_mistake)}</tr>`).join('');
  return page('Card ratings', '/admin/cards', `
<p>Red rows have 3 or more “Too spicy” or “Unsafe” reports: check them first. Rewrite or remove cards that many players dislike.</p>
<div class="scroll"><table><tr><th>Card</th><th>Text</th><th>👍</th><th>👎</th><th>Too spicy</th><th>Unsafe</th><th>Mean</th><th>Mistake</th></tr>${html}</table></div>`);
}

async function handlePost(path, request, store, now) {
  const form = await request.formData();
  const id = String(form.get('id') || '');
  const decided = now.toISOString();
  if (path === 'suggestion' && ID.test(id)) {
    const action = form.get('action');
    if (action === 'reject') await move(store, `s/pending/${id}`, `s/rejected/${id}`, { decided });
    if (action === 'approve') {
      const type = TYPES.includes(form.get('type')) ? form.get('type') : 'truth';
      const level = LEVELS.includes(form.get('level')) ? form.get('level') : 'friends';
      const heat = ['couples', 'spicy'].includes(level) ? Math.min(3, Math.max(1, Number(form.get('heat')) || 1)) : 0;
      const text = String(form.get('text') || '').replace(/\s+/g, ' ').trim().slice(0, 150);
      if (text) await move(store, `s/pending/${id}`, `s/approved/${id}`, { decided, text, type, level, heat });
    }
    return '/admin';
  }
  if (path === 'added') {
    const { blobs } = await store.list({ prefix: 's/approved/' });
    await Promise.all(blobs.map((b) => move(store, b.key, `s/added/${b.key.slice('s/approved/'.length)}`, { added: decided })));
    return '/admin/approved';
  }
  if (path === 'feedback-done' && ID.test(id)) {
    await move(store, `f/new/${id}`, `f/read/${id}`);
    return '/admin/feedback';
  }
  return '/admin';
}

/** Deletes rejected suggestions after 30 days and old hourly totals after 2 days. */
async function cleanUp(store, now) {
  const monthAgo = new Date(now - 30 * 864e5).toISOString();
  const twoDaysAgo = new Date(now - 2 * 864e5).toISOString().slice(0, 13);
  const rejected = await readAll(store, 's/rejected/', 1000);
  const { blobs: limits } = await store.list({ prefix: 'l/' });
  await Promise.all([
    ...rejected.filter((s) => s.decided < monthAgo).map((s) => store.delete(`s/rejected/${s.id}`)),
    ...limits.filter((b) => b.key.split('/')[2] < twoDaysAgo).map((b) => store.delete(b.key)),
  ]);
}

export async function handleAdmin(request, { store, env = {}, loadCards, now = new Date() }) {
  if (!env.ADMIN_PASSWORD) return new Response('Set ADMIN_PASSWORD in Netlify (Site configuration > Environment variables) first.', { status: 503 });
  if (!authorised(request, env.ADMIN_PASSWORD, env.ADMIN_USER)) {
    return new Response('Password needed', { status: 401, headers: { 'www-authenticate': 'Basic realm="TruthSpin admin", charset="UTF-8"', 'cache-control': 'no-store' } });
  }
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/admin\/?/, '').replace(/\/$/, '');

  if (request.method === 'POST') {
    if (request.headers.get('origin') !== url.origin) return new Response('Bad origin', { status: 403 });
    const back = await handlePost(path, request, store, now);
    return new Response(null, { status: 303, headers: { location: new URL(back, url).toString() } });
  }
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  await cleanUp(store, now);
  if (path === 'approved') return approvedPage(store);
  if (path === 'feedback') return feedbackPage(store);
  if (path === 'cards') return cardsPage(store, loadCards);
  return suggestionsPage(store);
}
