import { describe, it, expect, beforeEach } from 'vitest';
import { handleBatch, HOURLY } from '../../server/api.js';
import { handleAdmin } from '../../server/admin.js';

// Works like a Netlify Blobs store, in memory.
function memoryStore() {
  const m = new Map();
  return {
    m,
    async get(k, o) { const v = m.get(k); return v === undefined ? null : o?.type === 'json' ? JSON.parse(v) : v; },
    async setJSON(k, v) { m.set(k, JSON.stringify(v)); },
    async delete(k) { m.delete(k); },
    async list({ prefix = '' } = {}) { return { blobs: [...m.keys()].filter((k) => k.startsWith(prefix)).sort().map((key) => ({ key })) }; },
  };
}

const SITE = 'https://truthspin.app';
const post = (items, extra = {}) => new Request(`${SITE}/api/batch`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ v: '1.0.0', items, ...extra }),
});
const auth = { authorization: `Basic ${btoa('owner:secret-pass')}` };
const admin = (path, init = {}) => new Request(`${SITE}${path}`, { ...init, headers: { ...auth, ...init.headers } });
const keys = (store, prefix) => [...store.m.keys()].filter((k) => k.startsWith(prefix));
const cards = async (level) => (level === 'friends' ? [{ id: 'ft001', en: 'What song do you secretly love?' }] : []);

let store;
beforeEach(() => { store = memoryStore(); });

describe('POST /api/batch', () => {
  it('saves ratings, suggestions and feedback, and skips bad items', async () => {
    const res = await handleBatch(post([
      { k: 'vote', id: 'ft001', v: 'like' },
      { k: 'vote', id: 'ft001', v: 'dislike' },
      { k: 'vote', id: 'pd003', v: 'report', r: 'unsafe' },
      { k: 'suggest', type: 'dare', level: 'friends', heat: 0, text: 'Do your best pressure cooker whistle.', lang: 'en', day: '2026-10-21' },
      { k: 'feedback', mood: 4, topics: ['language', 'hacker'], note: 'Please add Tamil!', lang: 'en' },
      { k: 'suggest', type: 'truth', level: 'friends', text: 'call me on 98765 43210' },
      { k: 'vote', id: 'DROP TABLE', v: 'like' },
    ]), { store });
    expect(await res.json()).toEqual({ ok: true, saved: 5, skipped: 2 });
    expect(keys(store, 's/pending/')).toHaveLength(1);
    expect(keys(store, 'f/new/')).toHaveLength(1);
    const batch = JSON.parse(store.m.get(keys(store, 'v/e/')[0]));
    expect(batch).toEqual({ ft001: { likes: 1, dislikes: 1 }, pd003: { r_unsafe: 1 } });
    const fb = JSON.parse(store.m.get(keys(store, 'f/new/')[0]));
    expect(fb.topics).toEqual(['language']);
    expect(JSON.stringify([...store.m.values()])).not.toMatch(/98765|ip|user.?agent/i);
  });

  it('refuses nonsense', async () => {
    expect((await handleBatch(post([{ k: 'vote', id: 'x', v: 'like' }]), { store })).status).toBe(400);
    expect((await handleBatch(new Request(`${SITE}/api/batch`, { method: 'POST', body: 'xx' }), { store })).status).toBe(400);
    expect((await handleBatch(new Request(`${SITE}/api/batch`), { store })).status).toBe(405);
  });

  it('applies the hourly spam brake to suggestions', async () => {
    const now = new Date('2026-10-21T10:00:00Z');
    await store.setJSON('l/suggest/2026-10-21T10', { n: HOURLY.suggest });
    const res = await handleBatch(post([{ k: 'suggest', type: 'dare', level: 'friends', text: 'Sing like a pressure cooker.' }]), { store, now });
    expect(res.status).toBe(429);
  });

  it('asks for the spam check token when Turnstile is switched on', async () => {
    const res = await handleBatch(post([{ k: 'feedback', mood: 3 }]), { store, env: { TURNSTILE_SECRET: 'x' } });
    expect(res.status).toBe(403);
  });
});

describe('/admin', () => {
  const env = { ADMIN_PASSWORD: 'secret-pass' };

  it('needs the password', async () => {
    expect((await handleAdmin(new Request(`${SITE}/admin`), { store, env })).status).toBe(401);
    const wrong = new Request(`${SITE}/admin`, { headers: { authorization: `Basic ${btoa('a:nope')}` } });
    expect((await handleAdmin(wrong, { store, env })).status).toBe(401);
    expect((await handleAdmin(admin('/admin'), { store, env: {} })).status).toBe(503);
  });

  it('checks the user name too when ADMIN_USER is set', async () => {
    const withUser = { ADMIN_PASSWORD: 'secret-pass', ADMIN_USER: 'rohit' };
    const as = (name) => new Request(`${SITE}/admin`, { headers: { authorization: `Basic ${btoa(`${name}:secret-pass`)}` } });
    expect((await handleAdmin(as('owner'), { store, env: withUser })).status).toBe(401);
    expect((await handleAdmin(as('rohit'), { store, env: withUser })).status).toBe(200);
    expect((await handleAdmin(as('anyone'), { store, env })).status).toBe(200); // no ADMIN_USER: any name
  });

  it('approves an edited suggestion and lists it for copying, then marks it added', async () => {
    await handleBatch(post([{ k: 'suggest', type: 'dare', level: 'friends', text: 'Do a pressure cooker whistle.' }]), { store });
    const id = keys(store, 's/pending/')[0].slice('s/pending/'.length);
    const page = await (await handleAdmin(admin('/admin'), { store, env })).text();
    expect(page).toContain('Do a pressure cooker whistle.');

    const form = new URLSearchParams({ id, action: 'approve', text: 'Do your loudest pressure cooker whistle.', type: 'dare', level: 'friends', heat: '0' });
    const forged = await handleAdmin(admin('/admin/suggestion', { method: 'POST', body: form }), { store, env });
    expect(forged.status).toBe(403); // no Origin header: blocked

    const ok = await handleAdmin(admin('/admin/suggestion', { method: 'POST', body: form, headers: { origin: SITE } }), { store, env });
    expect(ok.status).toBe(303);
    expect(keys(store, 's/pending/')).toHaveLength(0);
    const approved = await (await handleAdmin(admin('/admin/approved'), { store, env })).text();
    expect(approved).toContain('Do your loudest pressure cooker whistle.');

    await handleAdmin(admin('/admin/added', { method: 'POST', body: new URLSearchParams(), headers: { origin: SITE } }), { store, env });
    expect(keys(store, 's/approved/')).toHaveLength(0);
    expect(keys(store, 's/added/')).toHaveLength(1);
  });

  it('rejects, and deletes rejected suggestions after 30 days', async () => {
    await handleBatch(post([{ k: 'suggest', type: 'truth', level: 'kids', text: 'What is your favourite colour?' }]), { store });
    const id = keys(store, 's/pending/')[0].slice('s/pending/'.length);
    const form = new URLSearchParams({ id, action: 'reject' });
    await handleAdmin(admin('/admin/suggestion', { method: 'POST', body: form, headers: { origin: SITE } }), { store, env, now: new Date('2026-10-01') });
    expect(keys(store, 's/rejected/')).toHaveLength(1);
    await handleAdmin(admin('/admin'), { store, env, now: new Date('2026-11-15') });
    expect(keys(store, 's/rejected/')).toHaveLength(0);
  });

  it('merges rating batches and shows the most-reported cards first, with their text', async () => {
    await handleBatch(post([{ k: 'vote', id: 'ft001', v: 'like' }]), { store });
    await handleBatch(post([{ k: 'vote', id: 'pd003', v: 'report', r: 'unsafe' }, { k: 'vote', id: 'pd003', v: 'report', r: 'spicy' }, { k: 'vote', id: 'pd003', v: 'report', r: 'unsafe' }]), { store });
    const html = await (await handleAdmin(admin('/admin/cards'), { store, env, loadCards: cards })).text();
    expect(keys(store, 'v/e/')).toHaveLength(0);
    expect(JSON.parse(store.m.get('v/summary'))).toEqual({ ft001: { likes: 1 }, pd003: { r_unsafe: 2, r_spicy: 1 } });
    expect(html.indexOf('pd003')).toBeLessThan(html.indexOf('ft001'));
    expect(html).toContain('class="flag"');
    expect(html).toContain('What song do you secretly love?');
  });

  it('escapes what players typed', async () => {
    await handleBatch(post([{ k: 'feedback', mood: 1, note: '<script>alert(1)</script> hi' }]), { store });
    const html = await (await handleAdmin(admin('/admin/feedback'), { store, env })).text();
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });
});


describe('visitor counts', () => {
  const env = { ADMIN_PASSWORD: 'secret-pass' };
  const now = new Date('2026-10-23T12:00:00Z');

  it('adds anonymous visits, new players, spins and cards to each day', async () => {
    const res = await handleBatch(post([
      { k: 'visit', new: 1, day: '2026-10-23' },
      { k: 'visit', new: 0, day: '2026-10-23' },
      { k: 'stats', spins: 12, cards: 9, day: '2026-10-23' },
      { k: 'stats', spins: 3, cards: 2, day: '2026-10-22' },
      { k: 'visit', new: 1, day: '2019-01-01' }, // far in the past: refused
      { k: 'stats', spins: 0, cards: 0, day: '2026-10-23' }, // nothing to add: skipped
    ]), { store, now });
    expect(await res.json()).toEqual({ ok: true, saved: 4, skipped: 2 });
    const batch = JSON.parse(store.m.get(keys(store, 'c/e/')[0]));
    expect(batch).toEqual({
      '2026-10-23': { visits: 2, newPlayers: 1, spins: 12, cards: 9 },
      '2026-10-22': { spins: 3, cards: 2 },
    });
    expect(JSON.stringify(batch)).not.toMatch(/ip|id|name/i);
  });

  it('shows today, yesterday, 7 days, 30 days and all time on the Visitors page', async () => {
    await handleBatch(post([{ k: 'visit', new: 1, day: '2026-10-23' }, { k: 'stats', spins: 5, cards: 4, day: '2026-10-23' }]), { store, now });
    await handleBatch(post([{ k: 'visit', new: 0, day: '2026-10-22' }]), { store, now });
    const html = await (await handleAdmin(admin('/admin/visitors'), { store, env, now })).text();
    expect(html).toContain('Visitors');
    expect(html).toMatch(/Today<\/div><div[^>]*>1<\/div>/);
    expect(html).toMatch(/Last 7 days<\/div><div[^>]*>2<\/div>/);
    expect(html).toContain('5 spins');
    expect(keys(store, 'c/e/')).toHaveLength(0); // merged into the summary
    expect(JSON.parse(store.m.get('c/summary'))['2026-10-23']).toEqual({ visits: 1, newPlayers: 1, spins: 5, cards: 4 });
  });
});
