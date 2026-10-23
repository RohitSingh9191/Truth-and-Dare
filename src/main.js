// TruthSpin: open, spin, Truth or Dare. Two taps to the first question.

import './app.css';
import { load, save } from './store.js';
import { LEVEL, visibleLevels, DEFAULT_LEVEL, GROUP_TYPES } from './levels.js';
import { setLang, t, cardText } from './i18n.js';
import { createBottle } from './bottle.js';
import { freeAngle, seatTarget, towardsSeat, nextSeat, nextPart, spinPlan, norm } from './picker.js';
import * as deck from './deck.js';
import * as sound from './sound.js';
import { h, icon, openLayer, anyLayerOpen, toast, ask } from './ui.js';
import { vote, reportSheet, feedbackSheet, flush, countVisit, countPlay } from './feedback.js';
import { ownCards, addSheet, readSharedLink, importSheet } from './custom.js';
import { invite, shareCard } from './share.js';
import { track, startAnalytics } from './analytics.js';
import { levelSheet, namesSheet, settingsSheet, iosTip, installSheet } from './sheets.js';
import { CARD_ID } from '../shared/validate.js';

// ---------- State ----------

const DEFAULTS = {
  lang: 'en', // English for everyone at first; Hinglish is one tap away (EN/HI button)
  sound: true,
  vibrate: true,
  gentle: null, // null = follow the phone's "reduce motion" setting
  family: false,
  pin: '',
  familyOwn: false,
  spicy: false,
  group: 'sometimes', // off | sometimes (every 5th turn) | often (every 3rd)
  mine: 'mixed', // mixed | only | builtin
  skip: 'free', // free | limited | forfeit
  big: false,
  theme: 'dark',
  fair: true,
  parts: 12, // numbered parts of the circle when there are no names (0 = off)
  heat: { couples: 1, spicy: 1 },
};
const stored = load('settings', {});
const settings = { ...DEFAULTS, ...stored, heat: { ...DEFAULTS.heat, ...stored.heat } };

const S = {
  level: load('level', DEFAULT_LEVEL),
  names: load('names', []),
  seats: { queue: [], last: -1 },
  lastStop: null,
  part: null, // the numbered part the bottle points at (no names)
  lastPart: null,
  partsShown: 0,
  ageOk: false, // asked again every time the game is opened
  heat3Ok: false,
  phase: 'idle', // idle | spinning | choice | card
  picked: null,
  turns: 0,
  rounds: load('rounds', 0),
  groupNext: 0,
  history: [],
  group: false,
  skipsUsed: {},
  started: false,
  timer: null,
};

const FORFEITS = 8;
const GROUP_EVERY = { sometimes: 5, often: 3 };

const $ = (id) => document.getElementById(id);
const els = {
  stage: $('stage'), bottle: $('bottle'), ring: $('ring'), live: $('live'),
  parts: $('parts'), partNums: $('partNums'), hint: document.querySelector('.controls .hint'),
  levelBtn: $('levelBtn'), levelName: $('levelName'), levelAge: $('levelAge'), heatBadge: $('heatBadge'),
  langBtn: $('langBtn'), soundBtn: $('soundBtn'), menuBtn: $('menuBtn'),
  idle: $('idle'), spinBtn: $('spinBtn'), tip: $('tip'),
  choice: $('choice'), pickLine: $('pickLine'),
  card: $('card'), cardType: $('cardType'), cardLeft: $('cardLeft'), cardPlayer: $('cardPlayer'),
  cardText: $('cardText'), cardHow: $('cardHow'), cardNote: $('cardNote'), cardMain: $('cardMain'), cardMiddle: $('cardMiddle'),
  turnBtn: $('turnBtn'),
  timerBtn: $('timerBtn'), rate: $('rate'), likeBtn: $('likeBtn'), dislikeBtn: $('dislikeBtn'), reportBtn: $('reportBtn'),
  shareBtn: $('shareBtn'), backBtn: $('backBtn'), skipBtn: $('skipBtn'), switchBtn: $('switchBtn'), doneBtn: $('doneBtn'),
};

const heatOf = (level) => (LEVEL[level]?.heat ? settings.heat[level] : 0);
const ownAllowed = () => !settings.family || settings.familyOwn;
const gentle = () => settings.gentle ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
const needsGrownUp = () => S.level === 'kids' || settings.family;

// ---------- Settings and top bar ----------

function setSetting(key, value) {
  settings[key] = value;
  save('settings', settings);
  applySettings();
}

function applySettings() {
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.classList.toggle('big', settings.big);
  setLang(settings.lang);
  els.soundBtn.replaceChildren(icon(settings.sound ? 'sound' : 'mute'));
  els.soundBtn.setAttribute('aria-pressed', String(settings.sound));
  els.langBtn.textContent = settings.lang === 'hi' ? 'HI' : 'EN';
  if (!visibleLevels(settings).some((l) => l.key === S.level)) setLevel(settings.family ? 'kids' : DEFAULT_LEVEL);
  renderTop();
  renderRing();
  renderPickLine();
  if (els.card.open && S.history.length) renderCard(S.history[S.history.length - 1]);
}

function renderTop() {
  const lvl = LEVEL[S.level];
  const root = document.documentElement;
  root.style.setProperty('--lvl', lvl.color);
  root.style.setProperty('--lvl-ink', lvl.ink);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.theme === 'light' ? '#f6f3ff' : '#15112b');
  root.dataset.level = S.level;
  els.levelName.textContent = t(`level_${S.level}`);
  els.levelAge.textContent = lvl.age === 'all' ? t('allAgesShort') : lvl.age;
  const heat = heatOf(S.level);
  els.heatBadge.replaceChildren(...(heat ? [...Array(heat)].map(() => icon('flame', 'flame')) : []));
  els.heatBadge.hidden = !heat;
  els.levelBtn.setAttribute('aria-label', `${t('level')}: ${t(`level_${S.level}`)}${heat ? `, ${t(`heat${heat}_${S.level}`)}` : ''}`);
}

function setLevel(level, heat) {
  S.level = level;
  if (heat && LEVEL[level].heat) settings.heat[level] = heat;
  save('level', level);
  save('settings', settings);
  renderTop();
  deck.loadLevel(level).catch(() => toast(t('loadFailed')));
}

/** The 18+ check, asked once every time the game is opened. */
async function confirmAdult() {
  if (S.ageOk) return true;
  S.ageOk = await ask(t('ageTitle'), t('ageLead'), t('ageYes'), t('ageNo'));
  return S.ageOk;
}

async function selectLevel(level, heat) {
  if (LEVEL[level].adult && !(await confirmAdult())) return false;
  if (heat === 3 && !S.heat3Ok) {
    S.heat3Ok = await ask(t('heat3Title'), t('heat3Lead'), t('heat3Yes'), t('cancel'));
    if (!S.heat3Ok) return false;
  }
  setLevel(level, heat);
  track(`level/${level}${heat ? `-${heat}` : ''}`);
  return true;
}

// ---------- Names around the bottle ----------

function setNames(names) {
  S.names = names;
  S.seats = { queue: [], last: -1 };
  save('names', names);
  renderRing();
}

// Names sit around the edge of the play area in seating order (clockwise from the top).
// They don't need equal angles: the player is picked first and the bottle then turns to point
// at that name. Names are wider than tall, so the sides of the screen hold more of them; we
// spread them by the room each one needs. If they would still touch, they get smaller.
const SEAT_STEPS = [
  { size: 1, max: 0.3, rings: [1] },
  { size: 0.92, max: 0.26, rings: [1] },
  { size: 0.86, maxPx: 86, rings: [1] },
  { size: 0.8, maxPx: 72, rings: [1] },
  { size: 0.76, maxPx: 62, rings: [1] },
  { size: 0.74, maxPx: 54, rings: [1] },
  { size: 0.74, maxPx: 50, rings: [1, 0.74] }, // last resort for very small screens
];
const BOTTLE_REACH = 154 / 260; // straw tip distance from the centre, as a share of bottle height

function placeSeats(chips, W, H, step) {
  const maxWidth = step.maxPx || Math.max(64, step.max * Math.max(W, 300));
  for (const c of chips) {
    c.style.fontSize = `${step.size}em`;
    c.style.maxWidth = `${maxWidth}px`;
  }
  const sizes = chips.map((c) => ({ w: c.offsetWidth, h: c.offsetHeight }));
  const n = chips.length;
  const GAP = 4;
  const maxW = Math.max(...sizes.map((s) => s.w));
  const maxH = Math.max(...sizes.map((s) => s.h));
  // Two boxes only touch when they are close both sideways and up-down, so we measure the walk
  // round the oval in "box steps": sideways moves count in name widths, up-down in name heights.
  const aspect = (maxW + GAP) / (maxH + GAP);
  const rx = Math.max(24, W / 2 - maxW / 2 - 6);
  const ry = Math.max(24, H / 2 - maxH / 2 - 6);
  const STEPS = 1440;
  const cum = [0];
  for (let k = 1; k <= STEPS; k++) {
    const a0 = ((k - 1) / STEPS) * 2 * Math.PI;
    const a1 = (k / STEPS) * 2 * Math.PI;
    const dx = Math.abs(rx * (Math.sin(a1) - Math.sin(a0)));
    const dy = Math.abs(ry * (Math.cos(a1) - Math.cos(a0)));
    cum.push(cum[k - 1] + Math.max(dx / aspect, dy));
  }
  const total = cum[STEPS];
  let k = 0;
  return chips.map((c, i) => {
    const want = (i * total) / n;
    while (k < STEPS && cum[k + 1] < want) k++;
    const frac = (want - cum[k]) / Math.max(1e-9, cum[k + 1] - cum[k]);
    const a = ((k + frac) / STEPS) * 2 * Math.PI;
    const ring = step.rings[i % step.rings.length];
    const x = W / 2 + Math.sin(a) * rx * ring;
    const y = H / 2 - Math.cos(a) * ry * ring;
    c.style.left = `${x}px`;
    c.style.top = `${y}px`;
    const { w, h: ht } = sizes[i];
    const deg = ((Math.atan2(x - W / 2, H / 2 - y) * 180) / Math.PI + 360) % 360;
    return { x: x - w / 2, y: y - ht / 2, w, h: ht, deg, dist: Math.hypot(x - W / 2, y - H / 2) };
  });
}

function seatsOverlap(boxes) {
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (a.x < b.x + b.w + 3 && b.x < a.x + a.w + 3 && a.y < b.y + b.h + 3 && b.y < a.y + a.h + 3) return true;
    }
  }
  return false;
}

function renderRing() {
  const n = S.names.length;
  els.ring.replaceChildren();
  els.stage.classList.toggle('has-names', n >= 2);
  document.body.classList.toggle('many-names', n >= 9);
  els.bottle.style.height = '';
  S.seatAngles = null;
  renderParts();
  if (n < 2) return;
  const W = els.stage.clientWidth;
  const H = els.stage.clientHeight;
  if (!W || !H) return;
  const chips = S.names.map((name) => h('span', { class: 'seat' }, name));
  els.ring.append(...chips);
  let boxes;
  for (const step of SEAT_STEPS) {
    boxes = placeSeats(chips, W, H, step);
    if (!seatsOverlap(boxes)) break;
  }
  S.seatAngles = boxes.map((b) => b.deg);
  // The bottle may reach the names (they sit on top of it) but not past them.
  const reach = Math.min(...boxes.map((b) => b.dist)) - 6;
  const fit = reach / BOTTLE_REACH;
  if (fit < els.bottle.offsetHeight) els.bottle.style.height = `${Math.max(80, fit)}px`;
  highlight(S.phase === 'choice' ? S.picked : null);
}

function highlight(index) {
  [...els.ring.children].forEach((el, i) => el.classList.toggle('picked', i === index));
}

// ---------- Numbered parts of the circle (no names) ----------
// Everyone takes the numbered part nearest them; the bottle always stops inside one part,
// never on a line, and that part lights up.

const SVG = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs) => {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};
const partCount = () => (S.names.length >= 2 ? 0 : Number(settings.parts) || 0);

function renderParts() {
  const n = partCount();
  els.parts.replaceChildren();
  els.partNums.replaceChildren();
  els.stage.classList.toggle('has-parts', n > 0);
  els.hint.dataset.i18n = n ? 'hintParts' : 'hintIdle';
  els.hint.textContent = t(els.hint.dataset.i18n);
  if (n !== S.partsShown) { S.part = null; S.lastPart = null; S.partsShown = n; }
  if (!n) return;
  const W = els.stage.clientWidth;
  const H = els.stage.clientHeight;
  if (!W || !H) return;
  const size = Math.max(150, Math.min(W, H) - 8);
  for (const box of [els.parts, els.partNums]) box.style.width = box.style.height = `${size}px`;

  // Drawn in a 200 x 200 box around the centre; 0 degrees is the top, going clockwise.
  const at = (r, deg) => {
    const a = (deg * Math.PI) / 180;
    return [r * Math.sin(a), -r * Math.cos(a)].map((v) => v.toFixed(2));
  };
  const inner = 30;
  const outer = 98;
  const labelR = 84;
  const step = 360 / n;
  const slices = svgEl('svg', { viewBox: '-100 -100 200 200' });
  const labels = svgEl('svg', { viewBox: '-100 -100 200 200' });
  for (let i = 0; i < n; i++) {
    const a0 = (i - 0.5) * step;
    const a1 = (i + 0.5) * step;
    const p = (r, a) => at(r, a).join(' ');
    slices.append(svgEl('path', {
      class: `part${i % 2 ? ' alt' : ''}`,
      d: `M${p(inner, a0)} L${p(outer, a0)} A${outer} ${outer} 0 0 1 ${p(outer, a1)} L${p(inner, a1)} A${inner} ${inner} 0 0 0 ${p(inner, a0)}Z`,
    }));
    const [x, y] = at(labelR, i * step);
    labels.append(svgEl('circle', { class: 'part-dot', cx: x, cy: y, r: n > 8 ? 8.5 : 10 }));
    const num = svgEl('text', { class: 'part-num', x, y, 'font-size': n > 8 ? 10 : 12 });
    num.textContent = String(i + 1);
    labels.append(num);
  }
  els.parts.append(slices);
  els.partNums.append(labels);
  // The straw tip reaches into the ring of numbers (they stay on top), never past it.
  const fit = ((size / 2) * 0.8) / BOTTLE_REACH;
  if (fit < els.bottle.offsetHeight) els.bottle.style.height = `${Math.max(90, fit)}px`;
  highlightPart(S.phase === 'choice' ? S.part : null);
}

function highlightPart(index) {
  els.parts.querySelectorAll('.part').forEach((p, i) => p.classList.toggle('on', i === index));
  els.partNums.querySelectorAll('.part-dot').forEach((p, i) => p.classList.toggle('on', i === index));
  els.partNums.querySelectorAll('.part-num').forEach((p, i) => p.classList.toggle('on', i === index));
}

// ---------- Spin ----------

let bottle;
let wakeLock = null;

async function keepAwake() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible' && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch { /* battery saver or not supported */ }
}

function setPhase(phase) {
  S.phase = phase;
  document.body.dataset.phase = phase;
  els.choice.hidden = phase !== 'choice';
  els.idle.hidden = phase === 'choice';
  els.spinBtn.disabled = phase === 'spinning';
}

function playerName() {
  if (S.names.length >= 2) return S.picked != null ? S.names[S.picked] : '';
  return S.part != null && partCount() ? t('partName', { n: S.part + 1 }) : '';
}

function renderPickLine() {
  const name = playerName();
  els.pickLine.textContent = name ? t('pickName', { name }) : t('pickNoName');
}

async function spin(dir = 1, speed = 0) {
  if ((S.phase !== 'idle' && S.phase !== 'choice') || bottle.spinning) return;
  sound.unlock();
  S.started = true;
  keepAwake();
  if (LEVEL[S.level].adult && !(await confirmAdult())) {
    setLevel(DEFAULT_LEVEL);
    toast(t('switchedToFriends'));
  }
  setPhase('spinning');
  highlight(null);
  highlightPart(null);
  els.live.textContent = t('spinning');
  const n = S.names.length;
  const parts = partCount();
  let target;
  S.part = null;
  if (n >= 2) {
    S.picked = nextSeat(n, S.seats, settings.fair);
    target = S.seatAngles ? towardsSeat(S.seatAngles, S.picked) : seatTarget(S.picked, n);
  } else if (parts) {
    S.picked = null;
    S.part = nextPart(parts, S.lastPart);
    S.lastPart = S.part;
    target = seatTarget(S.part, parts); // inside the part, well away from its lines
  } else {
    S.picked = null;
    target = freeAngle(S.lastStop);
  }
  S.lastStop = target;
  const onTick = () => { if (settings.sound) sound.tick(); };
  if (gentle()) {
    // Reduce motion: one short, calm turn straight to the result.
    await bottle.spinTo(bottle.angle + norm(target - bottle.angle), { duration: 450, onTick, curve: (x) => 1 - (1 - x) ** 2 });
  } else {
    const plan = spinPlan(bottle.angle, target, { dir, speed });
    await bottle.spinTo(plan.end, { duration: plan.duration, onTick });
  }
  if (settings.sound) sound.stopChime();
  if (settings.vibrate) sound.buzz(40);
  highlight(S.picked);
  highlightPart(S.part);
  renderPickLine();
  setPhase('choice');
  els.live.textContent = playerName() ? t('pickedName', { name: playerName() }) : t('stopped');
  track('spin');
  countPlay('spins');
}

// ---------- Cards ----------

function drawOptions(type) {
  return { level: S.level, heat: heatOf(S.level), type, family: settings.family, mine: settings.mine, own: ownAllowed() ? ownCards() : [] };
}

function drawEntry(type) {
  const res = deck.draw(drawOptions(type));
  if (res.exhausted) return { type, exhausted: true, total: res.total };
  return { type, card: res.card, left: res.left };
}

function typeLabel(type) {
  return t(`type_${type}`);
}

function renderCard(entry) {
  const { card, type } = entry;
  stopTimer();
  els.card.dataset.type = type;
  els.cardType.textContent = typeLabel(type);
  els.cardPlayer.textContent = S.group ? `${t('groupRound')}: ${t('everyone')}` : playerName();
  els.cardPlayer.hidden = !els.cardPlayer.textContent;
  els.backBtn.disabled = S.history.length < 2;
  els.cardNote.hidden = !entry.forfeit;
  if (entry.forfeit) els.cardNote.textContent = `${t('forfeit')}: ${t(`forfeit${entry.forfeit}`)}`;

  const isTD = type === 'truth' || type === 'dare';
  els.switchBtn.hidden = !isTD || S.group;
  if (isTD) els.switchBtn.querySelector('span').textContent = t(type === 'truth' ? 'switchToDare' : 'switchToTruth');
  els.skipBtn.querySelector('span').textContent = S.group ? t('another') : skipLabel();

  if (entry.exhausted) {
    els.cardText.className = 'card-text';
    els.cardText.textContent = t('exhausted', { n: entry.total, what: t(`plural_${type}`), level: t(`level_${S.level}`) });
    els.cardHow.hidden = true;
    els.cardLeft.textContent = '';
    els.timerBtn.hidden = true;
    els.rate.hidden = true;
    els.cardMain.replaceChildren(
      h('button', { class: 'btn primary', type: 'button', onclick: () => { deck.restart(drawOptions(type)); replaceTop(drawEntry(type)); } }, t('startAgain')),
      h('button', { class: 'btn', type: 'button', onclick: () => { els.card.close(); openLevels(); } }, t('changeLevel')),
    );
    els.cardMain.hidden = false;
    fitCardText();
    return;
  }

  els.cardMain.hidden = true;
  els.rate.hidden = false;
  const text = cardText(card);
  els.cardText.textContent = text;
  els.cardText.className = 'card-text';
  els.cardHow.hidden = isTD;
  if (!isTD) els.cardHow.textContent = t(`how_${type}`);
  els.cardLeft.textContent = entry.left != null ? t('left', { n: entry.left }) : '';
  els.timerBtn.hidden = !card.secs;
  if (card.secs) setTimerLabel(card.secs, false);
  for (const [btn, kind] of [[els.likeBtn, 'like'], [els.dislikeBtn, 'dislike'], [els.reportBtn, 'report']]) {
    btn.setAttribute('aria-pressed', String(entry.rated === kind));
  }
  els.shareBtn.hidden = !CARD_ID.test(card.id || '');
  fitCardText();
}

/** Makes the card text as big as the screen allows, without scrolling. */
function fitCardText() {
  if (!els.card.open) return;
  const box = els.cardMiddle;
  const p = els.cardText;
  const vw = innerWidth;
  const vh = innerHeight;
  const landscape = vw > vh && vh < 540;
  let hi = Math.min(72, Math.max(22, landscape ? vh * 0.09 : Math.min(vw * 0.1, vh * 0.068)));
  if (settings.big) hi *= 1.15;
  let lo = 14;
  p.style.fontSize = `${hi}px`;
  if (box.scrollHeight <= box.clientHeight + 1) return;
  for (let i = 0; i < 9; i++) {
    const mid = (lo + hi) / 2;
    p.style.fontSize = `${mid}px`;
    if (box.scrollHeight <= box.clientHeight + 1) lo = mid;
    else hi = mid;
  }
  p.style.fontSize = `${Math.floor(lo)}px`;
}

function showEntry(entry) {
  S.history.push(entry);
  if (S.history.length > 30) S.history.shift();
  renderCard(entry);
}

function replaceTop(entry) {
  S.history[S.history.length - 1] = entry;
  renderCard(entry);
}

const current = () => S.history[S.history.length - 1];

async function openTurn(type) {
  try { await deck.loadLevel(S.level); } catch { toast(t('loadFailed')); return; }
  S.group = false;
  S.history = [];
  S.skipsUsed._turn = 0;
  showEntry(drawEntry(type));
  setPhase('card');
  openCardView();
  track(type);
  countPlay('cards');
}

function openGroupRound() {
  S.group = true;
  S.history = [];
  let entry;
  for (let i = 0; i < GROUP_TYPES.length; i++) {
    const type = GROUP_TYPES[(S.groupNext + i) % GROUP_TYPES.length];
    entry = drawEntry(type);
    if (entry.exhausted) { deck.restart(drawOptions(type)); entry = drawEntry(type); }
    if (!entry.exhausted) { S.groupNext = (S.groupNext + i + 1) % GROUP_TYPES.length; break; }
  }
  if (!entry || entry.exhausted) { S.group = false; setPhase('idle'); return; }
  showEntry(entry);
  setPhase('card');
  openCardView();
}

function openCardView() {
  els.card.classList.remove('turned');
  openLayer(els.card, { onClose: endTurn });
  fitCardText(); // before the first frame, so the text never shows too big
  requestAnimationFrame(fitCardText);
}

function endTurn() {
  stopTimer();
  els.card.classList.remove('turned');
  const wasGroup = S.group;
  S.group = false;
  if (!wasGroup) {
    S.turns++;
    S.rounds++;
    save('rounds', S.rounds);
    const every = GROUP_EVERY[settings.group];
    if (every && S.turns % every === 0) {
      setTimeout(openGroupRound, 250);
      return;
    }
  }
  setPhase('idle');
  maybeShowTip();
}

function skipLabel() {
  if (settings.skip !== 'limited') return t('skip');
  const left = skipLimit() - (S.skipsUsed[skipKey()] || 0);
  return `${t('skip')} (${Math.max(0, left)})`;
}
const skipKey = () => (playerName() ? `p:${playerName()}` : '_turn');
const skipLimit = () => (playerName() ? 3 : 1);

function onSkip() {
  const entry = current();
  if (!entry) return;
  if (!S.group && settings.skip === 'limited') {
    const used = S.skipsUsed[skipKey()] || 0;
    if (used >= skipLimit()) { toast(t('noSkipsLeft')); return; }
    S.skipsUsed[skipKey()] = used + 1;
  }
  const next = drawEntry(entry.type);
  if (!S.group && settings.skip === 'forfeit') next.forfeit = 1 + Math.floor(Math.random() * FORFEITS);
  showEntry(next);
  track('skip');
}

function onSwitch() {
  const entry = current();
  if (!entry) return;
  showEntry(drawEntry(entry.type === 'truth' ? 'dare' : 'truth'));
  track('switch');
}

function onBack() {
  if (S.history.length < 2) return;
  S.history.pop();
  renderCard(current());
}

async function rate(kind) {
  const entry = current();
  if (!entry?.card || entry.rated) return;
  if (kind === 'report') {
    const reason = await reportSheet();
    if (!reason) return;
    entry.rated = 'report';
    deck.hide(entry.card.id);
    vote(entry.card, 'report', reason);
    toast(t('reportThanks'));
    showEntry(drawEntry(entry.type));
    return;
  }
  entry.rated = kind;
  vote(entry.card, kind);
  if (kind === 'dislike') {
    deck.hide(entry.card.id);
    toast(t('dislikeThanks'));
  } else toast(t('likeThanks'));
  renderCard(entry);
}

// ---------- Timer (only on cards that name a time) ----------

function setTimerLabel(secs, running) {
  els.timerBtn.querySelector('span').textContent = running ? t('timerRunning', { n: secs }) : t('timerStart', { n: secs });
  els.timerBtn.classList.toggle('running', running);
}

function stopTimer() {
  clearInterval(S.timer);
  S.timer = null;
}

function onTimer() {
  const card = current()?.card;
  if (!card?.secs) return;
  if (S.timer) { stopTimer(); setTimerLabel(card.secs, false); return; }
  let left = card.secs;
  sound.unlock();
  setTimerLabel(left, true);
  S.timer = setInterval(() => {
    left--;
    if (left > 0) { setTimerLabel(left, true); return; }
    stopTimer();
    els.timerBtn.querySelector('span').textContent = t('timeUp');
    els.timerBtn.classList.remove('running');
    if (settings.sound) sound.timerEnd();
    if (settings.vibrate) sound.buzz(300);
  }, 1000);
}

// ---------- Tips, install and sheets ----------

let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
});
window.addEventListener('appinstalled', () => {
  installEvent = null;
  track('installed');
  showGetApp();
  toast(t('installedToast'));
});

/** The "Get app" button shows until the game runs as an installed app. */
function showGetApp() {
  const btn = document.getElementById('getAppBtn');
  if (btn) btn.hidden = standalone() || load('installed', false);
}

async function install() {
  if (!installEvent) return false;
  installEvent.prompt();
  const choice = await installEvent.userChoice.catch(() => null);
  installEvent = null;
  return choice?.outcome === 'accepted';
}

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;

function maybeShowTip() {
  const shown = load('tips', {});
  let tip = null;
  if (S.rounds >= 5 && !shown.install && !standalone() && (installEvent || isIOS())) {
    tip = { key: 'install', text: t('tipInstall'), run: () => installSheet(app) };
  } else if (S.rounds >= 10 && !shown.feedback) {
    tip = { key: 'feedback', text: t('tipFeedback'), run: openFeedback };
  }
  if (!tip) { els.tip.hidden = true; return; }
  shown[tip.key] = true;
  save('tips', shown);
  els.tip.replaceChildren(h('button', { type: 'button', class: 'tip-btn', onclick: () => { els.tip.hidden = true; tip.run(); } }, tip.text));
  els.tip.hidden = false;
}

function openFeedback() {
  feedbackSheet({ needsGrownUp: needsGrownUp() });
}

function customCtx() {
  return {
    levels: visibleLevels(settings).map((l) => l.key),
    level: S.level,
    heat: heatOf,
    family: settings.family,
    settings,
    setSetting,
  };
}

function openLevels() {
  levelSheet(app);
}

const app = {
  settings, S, setSetting, heatOf, selectLevel, setNames, confirmAdult, install, renderTop,
  canInstall: () => Boolean(installEvent),
  isInstalled: () => standalone(),
  openLevels, openFeedback, invite,
  openAdd: () => addSheet(customCtx()),
  customCtx,
  setLevel,
  needsGrownUp,
};

// ---------- Links: shared cards (?q=id) and shared question packs (#add=...) ----------

async function openSharedCard(id) {
  const level = deck.levelOfId(id);
  if (!level || !visibleLevels(settings).some((l) => l.key === level)) {
    if (level === 'spicy' && !settings.family) toast(t('spicyOffHint'));
    return;
  }
  try { await deck.loadLevel(level); } catch { return; }
  const card = deck.findCard(id);
  if (!card) return;
  if (!(await selectLevel(level, card.heat))) return;
  S.group = false;
  S.picked = null;
  S.history = [];
  showEntry({ type: card.type, card });
  setPhase('card');
  openCardView();
}

function readLinks() {
  const params = new URLSearchParams(location.search);
  const q = params.get('q');
  const ref = (params.get('ref') || '').toLowerCase();
  if (/^[a-z-]{1,20}$/.test(ref)) track(`from/${ref}`); // which shares bring players
  if (params.has('q') || params.has('ref')) history.replaceState(null, '', location.pathname + location.hash);
  const pack = readSharedLink();
  if (pack) importSheet(pack, { ...customCtx(), onSaved: () => {} });
  else if (q && CARD_ID.test(q)) openSharedCard(q);
}

// ---------- Wire up ----------

function boot() {
  applySettings();
  setPhase('idle');

  bottle = createBottle(els.bottle, els.stage, {
    onGesture: ({ dir, speed }) => spin(dir, speed),
    canSpin: () => S.phase === 'idle' && !anyLayerOpen(),
  });

  els.spinBtn.addEventListener('click', () => spin());
  $('againBtn').addEventListener('click', () => spin());
  $('truthBtn').addEventListener('click', () => openTurn('truth'));
  $('dareBtn').addEventListener('click', () => openTurn('dare'));
  $('randomBtn').addEventListener('click', () => openTurn(Math.random() < 0.5 ? 'truth' : 'dare'));
  els.doneBtn.addEventListener('click', () => els.card.close());
  els.skipBtn.addEventListener('click', onSkip);
  els.switchBtn.addEventListener('click', onSwitch);
  els.backBtn.addEventListener('click', onBack);
  els.timerBtn.addEventListener('click', onTimer);
  els.likeBtn.addEventListener('click', () => rate('like'));
  els.dislikeBtn.addEventListener('click', () => rate('dislike'));
  els.reportBtn.addEventListener('click', () => rate('report'));
  els.shareBtn.addEventListener('click', () => {
    const e = current();
    if (e?.card) shareCard(e.card, S.level, typeLabel(e.type));
  });

  els.levelBtn.addEventListener('click', openLevels);
  els.langBtn.addEventListener('click', () => {
    setSetting('lang', settings.lang === 'hi' ? 'en' : 'hi');
    track(`lang/${settings.lang}`);
  });
  els.soundBtn.addEventListener('click', () => {
    setSetting('sound', !settings.sound);
    if (settings.sound) sound.unlock();
  });
  els.menuBtn.addEventListener('click', () => settingsSheet(app));
  $('namesBtn').addEventListener('click', () => namesSheet(app));
  $('addBtn').addEventListener('click', () => app.openAdd());
  $('inviteBtn').addEventListener('click', invite);
  $('feedbackBtn').addEventListener('click', openFeedback);

  document.addEventListener('keydown', (e) => {
    if (anyLayerOpen() || e.target.closest?.('input, textarea, button, select, a')) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (S.phase === 'idle') spin();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && S.started) keepAwake();
  });
  new ResizeObserver(() => renderRing()).observe(els.stage);
  new ResizeObserver(() => fitCardText()).observe(els.card);
  els.turnBtn.addEventListener('click', () => els.card.classList.toggle('turned'));

  // Buttons stay dimmed until the game can answer them (matters on slow networks).
  document.querySelectorAll('[data-boot]').forEach((b) => { b.disabled = false; });
  setPhase('idle');
  deck.loadLevel(S.level).catch(() => {});
  countVisit();
  showGetApp();
  $('getAppBtn').addEventListener('click', () => { installSheet(app); track('get-app'); });
  readLinks();
  startAnalytics();
  setTimeout(flush, 3000);
}

boot();
