// Anonymous game counts with GoatCounter: no cookies, no names, no question text, no device ids.
// Switched off until CONFIG.goatcounter is set. Each event is counted at most once per visit,
// which keeps us far inside GoatCounter's free plan.

import { CONFIG } from './config.js';

const counted = new Set();
const waiting = [];
let loading = false;

function load() {
  if (loading || !CONFIG.goatcounter) return;
  loading = true;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = `https://${CONFIG.goatcounter}.goatcounter.com/count`;
  s.onload = flush;
  document.head.append(s);
}

function flush() {
  const gc = window.goatcounter;
  if (!gc?.count) return;
  while (waiting.length) {
    const name = waiting.shift();
    gc.count({ path: name, title: name, event: true });
  }
}

/** Counts an event like 'spin' or 'level/party' once per visit. */
export function track(name) {
  if (!CONFIG.goatcounter || counted.has(name)) return;
  counted.add(name);
  waiting.push(name);
  if (window.goatcounter?.count) flush();
}

/** Loads the counter after the bottle is on screen, so it never slows the first paint. */
export function startAnalytics() {
  if (!CONFIG.goatcounter) return;
  const go = () => load();
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 4000 });
  else setTimeout(go, 2500);
}
