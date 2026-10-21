// One-time step: turns the writers' files in content/work/ into content/questions/,
// giving every card a stable id such as "ft012" (level letter, type letter, number).
// After this, content/questions/ is the file to edit. New cards go at the end of a level
// with the next free number; never reuse or renumber ids, because ratings point at them.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const LEVELS = { kids: 'k', friends: 'f', party: 'p', couples: 'c', spicy: 's' };
const TYPES = { truth: 't', dare: 'd', 'would-you-rather': 'w', 'never-have-i-ever': 'n', 'most-likely-to': 'm' };

mkdirSync('content/questions', { recursive: true });

for (const [level, l] of Object.entries(LEVELS)) {
  const work = JSON.parse(readFileSync(`content/work/${level}.json`, 'utf8'));
  const counters = {};
  const cards = work.cards.map((c) => {
    const tl = TYPES[c.type];
    if (!tl) throw new Error(`${level}: unknown type ${c.type}`);
    counters[tl] = (counters[tl] || 0) + 1;
    const card = { id: `${l}${tl}${String(counters[tl]).padStart(3, '0')}`, type: c.type };
    if (c.heat) card.heat = c.heat;
    card.en = c.en.trim();
    card.hi = c.hi.trim();
    if (c.tags?.length) card.tags = c.tags;
    if (c.secs) card.secs = c.secs;
    return card;
  });
  writeFileSync(`content/questions/${level}.json`, `${JSON.stringify({ level, cards }, null, 2)}\n`);
  console.log(`${level}: ${cards.length} cards`);
}
