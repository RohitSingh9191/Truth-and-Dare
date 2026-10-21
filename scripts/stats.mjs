// Numbers for the handover document: first-download size and cards per heat level.
// Run after `npm run build`:  node scripts/stats.mjs [unitTests] [e2eTests]

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const gz = (file) => gzipSync(readFileSync(file)).length;
const html = readFileSync('dist/index.html', 'utf8');
const assets = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(?:js|css))"/g)].map((m) => `dist/${m[1]}`);
const firstLoad = gz('dist/index.html') + assets.reduce((n, f) => n + gz(f), 0);

const heatCounts = {};
for (const level of ['couples', 'spicy']) {
  const cards = JSON.parse(readFileSync(`content/questions/${level}.json`, 'utf8')).cards;
  heatCounts[level] = {};
  for (const c of cards) heatCounts[level][c.heat] = (heatCounts[level][c.heat] || 0) + 1;
}
const questionKB = Object.fromEntries(readdirSync('dist/q').map((f) => [f, Math.round(gz(`dist/q/${f}`) / 1024)]));

const stats = {
  firstLoadKB: String(Math.round(firstLoad / 1024)),
  questionFilesKB: questionKB,
  heatCounts,
  unitTests: process.argv[2] || '',
  e2eTests: process.argv[3] || '',
};
mkdirSync('docs', { recursive: true });
writeFileSync('docs/stats.json', JSON.stringify(stats, null, 2));
console.log(stats);
