// Question decks. Every level, heat and type is a deck: a card comes back only after every
// other card in that deck was shown. We remember which cards were seen (not a fixed order),
// so new cards added in an update join the current deck straight away.

import { load, save } from './store.js';
import { random } from './picker.js';

const cards = {}; // level key -> built-in cards
let seen = load('seen', {}); // deck key -> ids already shown
const hidden = new Set(load('hidden', [])); // ids disliked or reported on this phone

export async function loadLevel(level) {
  if (cards[level]) return cards[level];
  const res = await fetch(`${import.meta.env.BASE_URL}q/${level}.json`);
  if (!res.ok) throw new Error(`questions ${level}: ${res.status}`);
  const data = await res.json();
  cards[level] = data.cards;
  return cards[level];
}

export const isLoaded = (level) => Boolean(cards[level]);

export function levelOfId(id) {
  return { k: 'kids', f: 'friends', p: 'party', c: 'couples', s: 'spicy' }[id?.[0]];
}

export function findCard(id) {
  return cards[levelOfId(id)]?.find((c) => c.id === id);
}

export function sampleCard(level) {
  return cards[level]?.find((c) => c.type === 'truth' && (c.heat || 1) === 1);
}

const deckKey = (src, o) => `${src}|${o.level}|${o.heat || 0}|${o.type}`;

function fits(o) {
  return (c) =>
    c.type === o.type &&
    (!o.heat || (c.heat || 1) === o.heat) &&
    !hidden.has(c.id) &&
    !(o.family && c.tags?.includes('crush'));
}

function unseen(key, list) {
  const done = new Set(seen[key] || []);
  return list.filter((c) => !done.has(c.id));
}

function markSeen(key, id) {
  (seen[key] ||= []).push(id);
  save('seen', seen);
}

/**
 * Draws one card.
 * o = { level, heat, type, family, mine: 'mixed'|'only'|'builtin', own: [own cards allowed now] }
 * Returns { card, left } or { exhausted: true, total }.
 * Own questions come up in about 1 of every 3 cards when mixed, and look like any other card.
 */
export function draw(o, rnd = random) {
  const ok = fits(o);
  const built = (cards[o.level] || []).filter(ok);
  const own = o.mine === 'builtin' ? [] : (o.own || []).filter((c) => c.level === o.level && ok(c));
  const onlyOwn = o.mine === 'only' && own.length > 0;
  const kb = deckKey('b', o);
  const km = deckKey('m', o);

  let freshOwn = unseen(km, own);
  if (onlyOwn && !freshOwn.length) {
    // A short list of own questions simply starts again.
    seen[km] = [];
    freshOwn = own;
  }
  const freshBuilt = onlyOwn ? [] : unseen(kb, built);

  let fromOwn;
  if (onlyOwn) fromOwn = true;
  else fromOwn = freshOwn.length > 0 && (!freshBuilt.length || rnd() < 1 / 3);

  const list = fromOwn ? freshOwn : freshBuilt;
  if (!list.length) return { exhausted: true, total: built.length };

  const card = list[Math.floor(rnd() * list.length)];
  markSeen(fromOwn ? km : kb, card.id);
  return { card, left: freshBuilt.length + freshOwn.length - 1 };
}

/** Starts a deck again after it ran out. */
export function restart(o) {
  delete seen[deckKey('b', o)];
  delete seen[deckKey('m', o)];
  save('seen', seen);
}

/** New built-in cards left for a level (truths and dares), for the level menu. */
export function newCount(level, heat, family) {
  let n = 0;
  for (const type of ['truth', 'dare']) {
    const o = { level, heat, type, family };
    n += unseen(deckKey('b', o), (cards[level] || []).filter(fits(o))).length;
  }
  return n;
}

export function resetSeen() {
  seen = {};
  save('seen', seen);
}

export function hide(id) {
  hidden.add(id);
  save('hidden', [...hidden]);
}

export function isHidden(id) {
  return hidden.has(id);
}
