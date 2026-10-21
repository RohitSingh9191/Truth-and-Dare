import { describe, it, expect, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';

// The deck loads question files with fetch; serve them from disk.
vi.stubGlobal('fetch', async (url) => {
  const level = String(url).match(/q\/(\w+)\.json/)[1];
  const body = readFileSync(`content/questions/${level}.json`, 'utf8');
  return { ok: true, json: async () => JSON.parse(body) };
});

const deck = await import('../../src/deck.js');

beforeAll(async () => {
  for (const l of ['kids', 'friends', 'party', 'couples', 'spicy']) await deck.loadLevel(l);
});

const opts = (extra) => ({ level: 'friends', heat: 0, type: 'truth', family: false, mine: 'builtin', own: [], ...extra });

describe('decks', () => {
  it('shows every card once before any card repeats', () => {
    deck.resetSeen();
    const o = opts();
    const seen = new Set();
    let res = deck.draw(o);
    while (!res.exhausted) {
      expect(seen.has(res.card.id)).toBe(false);
      seen.add(res.card.id);
      res = deck.draw(o);
    }
    expect(seen.size).toBe(68);
    deck.restart(o);
    expect(deck.draw(o).exhausted).toBeUndefined();
  });

  it('counts down the cards left', () => {
    deck.resetSeen();
    const first = deck.draw(opts({ type: 'dare' }));
    const second = deck.draw(opts({ type: 'dare' }));
    expect(second.left).toBe(first.left - 1);
  });

  it('keeps 18+ heat levels apart', () => {
    deck.resetSeen();
    for (const heat of [1, 2, 3]) {
      for (let i = 0; i < 15; i++) {
        const r = deck.draw(opts({ level: 'spicy', heat }));
        expect(r.card.heat).toBe(heat);
      }
    }
  });

  it('Family mode hides crush cards', () => {
    deck.resetSeen();
    const o = opts({ family: true });
    let r = deck.draw(o);
    while (!r.exhausted) {
      expect(r.card.tags || []).not.toContain('crush');
      r = deck.draw(o);
    }
  });

  it('never shows a hidden (disliked or reported) card', () => {
    deck.resetSeen();
    const o = opts({ type: 'would-you-rather' });
    const victim = deck.draw(o).card;
    deck.hide(victim.id);
    deck.restart(o);
    let r = deck.draw(o);
    while (!r.exhausted) {
      expect(r.card.id).not.toBe(victim.id);
      r = deck.draw(o);
    }
  });

  it('mixes own questions in about 1 of 3 cards, and "only mine" shows only them', () => {
    deck.resetSeen();
    const own = Array.from({ length: 30 }, (_, i) => ({ id: `u${i}`, type: 'truth', level: 'friends', heat: 0, text: `Own question ${i}?` }));
    let mine = 0;
    for (let i = 0; i < 60; i++) {
      const r = deck.draw(opts({ mine: 'mixed', own }));
      if (r.card.id.startsWith('u')) mine++;
    }
    expect(mine).toBeGreaterThan(8);
    expect(mine).toBeLessThan(35);
    for (let i = 0; i < 50; i++) expect(deck.draw(opts({ mine: 'only', own })).card.id).toMatch(/^u/);
  });
});
