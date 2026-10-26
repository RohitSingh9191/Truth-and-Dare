import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { checkText } from '../../shared/validate.js';
import { STRINGS } from '../../src/strings.js';

const load = (level) => JSON.parse(readFileSync(`content/questions/${level}.json`, 'utf8')).cards;
const count = (cards, key) => cards.reduce((m, c) => ({ ...m, [c[key]]: (m[c[key]] || 0) + 1 }), {});

describe('question bank', () => {
  it('has the planned mix in the three all-ages levels', () => {
    for (const level of ['kids', 'friends', 'party']) {
      const cards = load(level);
      expect(cards.length, level).toBe(150);
      expect(count(cards, 'type'), level).toEqual({ truth: 68, dare: 52, 'would-you-rather': 10, 'never-have-i-ever': 10, 'most-likely-to': 10 });
    }
  });

  it('splits both 18+ levels into three heat levels of about 60 cards', () => {
    for (const level of ['couples', 'spicy']) {
      const cards = load(level);
      expect(cards.length, level).toBe(180);
      const heats = count(cards, 'heat');
      for (const h of [1, 2, 3]) expect(heats[h], `${level} heat ${h}`).toBeGreaterThanOrEqual(55);
      for (const h of [1, 2, 3]) {
        const atHeat = cards.filter((c) => c.heat === h);
        for (const type of ['truth', 'dare']) {
          expect(atHeat.filter((c) => c.type === type).length, `${level} heat ${h} ${type}`).toBeGreaterThanOrEqual(15);
        }
      }
    }
  });

  it('every card has a unique id, English and Hinglish, and no contact details', () => {
    const ids = new Set();
    for (const level of ['kids', 'friends', 'party', 'couples', 'spicy']) {
      for (const c of load(level)) {
        expect(ids.has(c.id), c.id).toBe(false);
        ids.add(c.id);
        expect(c.en.trim().length, c.id).toBeGreaterThan(10);
        expect(c.hi?.trim().length, c.id).toBeGreaterThan(10);
        expect(/[ऀ-ॿ]/.test(c.hi), `${c.id} Hinglish must use English letters`).toBe(false);
        expect(checkText(c.en, 400), `${c.id}: ${c.en}`).toBeNull();
        if (c.tags?.includes('timer')) expect(c.secs, c.id).toBeGreaterThan(0);
      }
    }
  });

  it('Friends marks crush cards so Family mode can hide them', () => {
    expect(load('friends').filter((c) => c.tags?.includes('crush')).length).toBeGreaterThan(5);
  });
});

describe('screen text', () => {
  it('Hinglish has no keys that English lacks (catches typos)', () => {
    const extra = Object.keys(STRINGS.hi).filter((k) => !(k in STRINGS.en));
    expect(extra).toEqual([]);
  });

  it('placeholders match between languages', () => {
    for (const [k, v] of Object.entries(STRINGS.hi)) {
      const a = (STRINGS.en[k].match(/\{\w+\}/g) || []).sort();
      const b = (v.match(/\{\w+\}/g) || []).sort();
      expect(b, k).toEqual(a);
    }
  });
});


describe('question-list pages for Google', () => {
  it('exist, have one clear heading, a matching canonical address and no 18+ "Very hot" cards', async () => {
    const { readFileSync, existsSync } = await import('node:fs');
    const pages = JSON.parse(readFileSync('public/pages.json', 'utf8'));
    expect(pages.length).toBeGreaterThanOrEqual(8);
    const hot = new Set(JSON.parse(readFileSync('content/questions/couples.json', 'utf8')).cards.filter((c) => c.heat === 3).flatMap((c) => [c.en, c.hi]));
    for (const { slug } of pages) {
      const html = readFileSync(`public/${slug}/index.html`, 'utf8');
      expect((html.match(/<h1>/g) || []).length, slug).toBe(1);
      expect(html, slug).toMatch(new RegExp(`rel="canonical" href="https://[^"]+/${slug}/"`));
      expect(html.length, slug).toBeGreaterThan(5000);
      for (const li of html.matchAll(/<li>([^<]+)<\/li>/g)) {
        const text = li[1].replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
        expect(hot.has(text), `${slug}: heat-3 card on a public page`).toBe(false);
      }
      for (const href of html.matchAll(/href="\/([a-z-]+)\/"/g)) expect(existsSync(`public/${href[1]}/index.html`), `${slug} links to /${href[1]}/`).toBe(true);
    }
    const sitemap = readFileSync('public/sitemap.xml', 'utf8');
    for (const { slug } of pages) expect(sitemap).toContain(`/${slug}/</loc>`);
  });
});
