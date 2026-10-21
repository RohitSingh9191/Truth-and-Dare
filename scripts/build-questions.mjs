// Checks content/questions/*.json and writes the small files the game loads (public/q/*.json).
// Run by `npm run dev` and `npm run build`. Stops the build if a card is broken.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const LEVELS = { kids: 'k', friends: 'f', party: 'p', couples: 'c', spicy: 's' };
const TYPES = { truth: 't', dare: 'd', 'would-you-rather': 'w', 'never-have-i-ever': 'n', 'most-likely-to': 'm' };
const HEAT_LEVELS = ['couples', 'spicy'];
const MAX_WORDS = 22;

const errors = [];
const warnings = [];
const seenIds = new Set();
let total = 0;

mkdirSync('public/q', { recursive: true });

for (const [level, letter] of Object.entries(LEVELS)) {
  const file = `content/questions/${level}.json`;
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const out = [];
  for (const c of data.cards) {
    const where = `${file} ${c.id || '(no id)'}`;
    if (!TYPES[c.type]) errors.push(`${where}: unknown type "${c.type}"`);
    if (!new RegExp(`^${letter}${TYPES[c.type]}\\d{3}$`).test(c.id || '')) errors.push(`${where}: id must look like ${letter}${TYPES[c.type] || '?'}001`);
    if (seenIds.has(c.id)) errors.push(`${where}: duplicate id`);
    seenIds.add(c.id);
    if (!c.en?.trim()) errors.push(`${where}: missing English text`);
    if (!c.hi?.trim()) warnings.push(`${where}: missing Hinglish text (English will show)`);
    if (c.en && c.en.trim().split(/\s+/).length > MAX_WORDS) warnings.push(`${where}: more than ${MAX_WORDS} words`);
    if (HEAT_LEVELS.includes(level) && ![1, 2, 3].includes(c.heat)) errors.push(`${where}: heat must be 1, 2 or 3`);
    if (c.tags?.includes('timer') && !(c.secs > 0)) errors.push(`${where}: timer card needs "secs"`);
    const card = { id: c.id, type: c.type, en: c.en.trim() };
    if (c.hi?.trim()) card.hi = c.hi.trim();
    if (c.heat) card.heat = c.heat;
    if (c.secs) card.secs = c.secs;
    if (c.tags?.length) card.tags = c.tags;
    out.push(card);
  }
  total += out.length;
  writeFileSync(`public/q/${level}.json`, JSON.stringify({ level, cards: out }));
}

warnings.forEach((w) => console.warn(`warning: ${w}`));
if (errors.length) {
  errors.forEach((e) => console.error(`error: ${e}`));
  process.exit(1);
}
console.log(`questions: ${total} cards checked and written to public/q/`);
