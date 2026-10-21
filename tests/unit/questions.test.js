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
