// Players' own questions: saved on this phone, mixed into the game, backed up as text,
// and shared with friends as a WhatsApp link (the questions travel inside the link itself).

import { load, save, askToKeepData } from './store.js';
import { t } from './i18n.js';
import { h, sheet, toast, segmented, toggleRow, icon, focusSoon } from './ui.js';
import { LEVEL, TYPES, HEATS } from './levels.js';
import { LEVEL_KEYS, TYPE_KEYS, MAX_QUESTION, checkText, cleanText } from '../shared/validate.js';
import { suggest, grownUpCheck, flush } from './feedback.js';
import { track } from './analytics.js';

let own = load('own', []);

export const ownCards = () => own;

function persist() {
  save('own', own);
  askToKeepData();
}

const newId = () => `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function valid(q) {
  return q && TYPE_KEYS.includes(q.type) && LEVEL_KEYS.includes(q.level) && typeof q.text === 'string' && q.text.trim().length >= 3;
}

function addMany(list) {
  const known = new Set(own.map((q) => `${q.level}|${q.text.toLowerCase()}`));
  let added = 0;
  for (const raw of list) {
    const q = {
      id: newId(),
      type: raw.type,
      level: raw.level,
      heat: LEVEL[raw.level]?.heat ? (HEATS.includes(raw.heat) ? raw.heat : 1) : 0,
      text: cleanText(raw.text).slice(0, MAX_QUESTION),
      created: Date.now(),
    };
    if (!valid(q)) continue;
    const key = `${q.level}|${q.text.toLowerCase()}`;
    if (known.has(key)) continue;
    known.add(key);
    own.push(q);
    added++;
  }
  persist();
  return added;
}

// ---------- Add or edit one question ----------

/**
 * ctx = { levels: visible level keys, level, heat(levelKey), family, onSaved() }
 * existing = an own question to edit, or undefined.
 */
export function addSheet(ctx, existing) {
  let type = existing?.type || 'truth';
  let level = existing?.level || ctx.level;
  if (!ctx.levels.includes(level)) level = ctx.levels[0];
  let heat = existing?.heat || ctx.heat(level) || 1;

  const text = h('textarea', { maxlength: MAX_QUESTION, rows: 3, 'aria-label': t('yourQuestion') });
  text.value = existing?.text || '';
  const count = h('small', { class: 'count' }, `${text.value.length}/${MAX_QUESTION}`);
  const err = h('p', { class: 'error', 'aria-live': 'polite' });
  const setPlaceholder = () => { text.placeholder = t(`ph_${type}`); };
  text.addEventListener('input', () => { count.textContent = `${text.value.length}/${MAX_QUESTION}`; err.textContent = ''; });
  setPlaceholder();

  let share = false;
  const heatBox = h('div');
  const renderHeat = () => {
    heatBox.replaceChildren();
    if (!LEVEL[level].heat) return;
    heatBox.append(h('p', { class: 'label' }, t('heat')),
      segmented(HEATS.map((n) => ({ value: n, label: t(`heat${n}_${level}`) })), heat, (v) => { heat = v; }, t('heat')));
  };
  renderHeat();

  const s = sheet(existing ? t('editQuestion') : t('addQuestion'), [
    h('label', { class: 'field' }, h('span', { class: 'label first' }, t('yourQuestion')), text, count),
    h('p', { class: 'label' }, t('type')),
    segmented(TYPES.map((k) => ({ value: k, label: t(`type_${k}`) })), type, (v) => { type = v; setPlaceholder(); }, t('type')),
    h('p', { class: 'label' }, t('level')),
    segmented(ctx.levels.map((k) => ({ value: k, label: t(`level_${k}`) })), level, (v) => { level = v; heat = ctx.heat(v) || 1; renderHeat(); }, t('level')),
    heatBox,
    !existing && toggleRow(t('suggestToAll'), false, (on) => { share = on; }, t('suggestNote')),
    err,
    h('button', {
      class: 'btn primary', type: 'button',
      onclick: async () => {
        const value = cleanText(text.value);
        const bad = checkText(value, MAX_QUESTION);
        if (bad === 'empty') { err.textContent = t('errEmpty'); return; }
        if (share) {
          if (bad === 'contact') { err.textContent = t('errContact'); return; }
          if ((level === 'kids' || ctx.family) && !(await grownUpCheck())) return;
        }
        const q = { type, level, heat: LEVEL[level].heat ? heat : 0, text: value };
        if (existing) Object.assign(existing, q);
        else own.push({ id: newId(), created: Date.now(), ...q });
        persist();
        track('own-question');
        let note = t('savedOwn');
        if (share) {
          const problem = suggest(q, document.documentElement.lang);
          note = problem ? t(problem === 'tooMany' ? 'errTooMany' : 'errContact') : t('savedAndSuggested');
          flush();
        }
        s.close();
        toast(note);
        ctx.onSaved?.();
      },
    }, t('save')),
  ]);
  focusSoon(text);
}

// ---------- My questions ----------

export function myQuestionsSheet(ctx) {
  const list = h('div', { class: 'own-list' });
  const render = () => {
    list.replaceChildren();
    if (!own.length) {
      list.append(h('p', { class: 'muted' }, t('noOwn')));
      return;
    }
    for (const key of LEVEL_KEYS) {
      const items = own.filter((q) => q.level === key);
      if (!items.length) continue;
      list.append(h('h3', { class: 'own-level', style: { '--lvl': LEVEL[key].color } }, t(`level_${key}`)));
      for (const q of items) {
        list.append(h('div', { class: 'own-row' },
          h('div', { class: 'own-text' },
            h('small', {}, t(`type_${q.type}`), q.heat ? ` · ${t(`heat${q.heat}_${q.level}`)}` : ''),
            h('span', {}, q.text)),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('edit'), onclick: () => { s.close(); addSheet(ctx, q); } }, icon('edit')),
          h('button', {
            class: 'icon-btn', type: 'button', 'aria-label': t('delete'),
            onclick: () => { own = own.filter((x) => x !== q); persist(); render(); },
          }, icon('trash')),
        ));
      }
    }
  };
  render();

  const s = sheet(t('myQuestions'), [
    h('p', { class: 'label' }, t('mineMode')),
    segmented(['mixed', 'only', 'builtin'].map((v) => ({ value: v, label: t(`mine_${v}`) })), ctx.settings.mine, (v) => ctx.setSetting('mine', v), t('mineMode')),
    h('div', { class: 'row-btns' },
      h('button', { class: 'btn', type: 'button', onclick: () => { s.close(); addSheet(ctx); } }, icon('plus'), t('addQuestion')),
      h('button', { class: 'btn', type: 'button', disabled: !own.length, onclick: () => shareOwn() }, icon('whatsapp'), t('shareOwn')),
    ),
    list,
    h('div', { class: 'row-btns' },
      h('button', { class: 'btn', type: 'button', onclick: () => { s.close(); backupSheet(); } }, t('backup')),
      h('button', { class: 'btn', type: 'button', onclick: () => { s.close(); restoreSheet(ctx); } }, t('restore')),
    ),
    h('p', { class: 'fine' }, t('ownPrivacy')),
  ]);
}

// ---------- Backup and restore ----------

function backupText() {
  return JSON.stringify({ app: 'truthspin', v: 1, questions: own.map(({ type, level, heat, text }) => ({ type, level, heat, text })) });
}

function backupSheet() {
  const code = h('textarea', { rows: 6, readonly: true, 'aria-label': t('backupCode') });
  code.value = backupText();
  sheet(t('backup'), [
    h('p', { class: 'lead' }, t('backupLead')),
    code,
    h('div', { class: 'row-btns' },
      h('button', {
        class: 'btn primary', type: 'button',
        onclick: async () => {
          try { await navigator.clipboard.writeText(code.value); toast(t('copied')); } catch { code.select(); }
        },
      }, t('copy')),
      h('button', {
        class: 'btn', type: 'button',
        onclick: () => {
          const a = h('a', { href: URL.createObjectURL(new Blob([code.value], { type: 'application/json' })), download: 'truthspin-questions.json' });
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        },
      }, t('download')),
    ),
  ]);
}

function parseBackup(text) {
  try {
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : data.questions;
    return Array.isArray(list) ? list.filter(valid) : null;
  } catch { return null; }
}

function restoreSheet(ctx) {
  const code = h('textarea', { rows: 6, placeholder: t('restorePaste'), 'aria-label': t('backupCode') });
  const file = h('input', { type: 'file', accept: '.json,.txt,application/json,text/plain', class: 'file' });
  const err = h('p', { class: 'error', 'aria-live': 'polite' });
  file.addEventListener('change', async () => { code.value = await file.files[0]?.text() || ''; });
  const s = sheet(t('restore'), [
    h('p', { class: 'lead' }, t('restoreLead')),
    code,
    h('label', { class: 'btn file-btn' }, t('chooseFile'), file),
    err,
    h('button', {
      class: 'btn primary', type: 'button',
      onclick: () => {
        const list = parseBackup(code.value);
        if (!list) { err.textContent = t('restoreBad'); return; }
        const n = addMany(list);
        s.close();
        toast(t('restored', { n }));
        ctx.onSaved?.();
      },
    }, t('restore')),
  ]);
}

// ---------- Share with friends as a link ----------

function encode(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(str) {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
}

function shareOwn() {
  const q = own.slice(-40).map((x) => [TYPE_KEYS.indexOf(x.type), x.level, x.heat || 0, x.text]);
  const url = `${location.origin}/?ref=pack#add=${encode({ v: 1, q })}`;
  const text = t('shareOwnMsg', { n: q.length, url });
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  track('share-own');
}

/** Reads #add=... from the address. Shared questions never go into Kids & Family automatically. */
export function readSharedLink() {
  const m = location.hash.match(/^#add=([\w-]+)$/);
  if (!m) return null;
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const data = decode(m[1]);
    return (data.q || []).map(([ti, level, heat, text]) => ({
      type: TYPE_KEYS[ti], level: level === 'kids' ? 'friends' : level, heat, text: String(text || ''),
    })).filter(valid).slice(0, 40);
  } catch { return null; }
}

export async function importSheet(list, ctx) {
  const allowed = list.filter((q) => ctx.levels.includes(q.level));
  if (!allowed.length) { toast(t('importNone')); return; }
  const preview = h('div', { class: 'own-list' }, allowed.map((q) => h('div', { class: 'own-row' },
    h('div', { class: 'own-text' }, h('small', {}, `${t(`level_${q.level}`)} · ${t(`type_${q.type}`)}`), h('span', {}, q.text)))));
  const yes = await new Promise((resolve) => {
    let ok = false;
    const s = sheet(t('importTitle', { n: allowed.length }), [
      h('p', { class: 'lead' }, t('importLead')),
      preview,
      h('div', { class: 'stack' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => { ok = true; s.close(); } }, t('importAdd', { n: allowed.length })),
        h('button', { class: 'btn', type: 'button', onclick: () => s.close() }, t('cancel'))),
    ], { onClose: () => resolve(ok) });
  });
  if (!yes) return;
  const n = addMany(allowed);
  toast(t('restored', { n }));
  ctx.onSaved?.();
}

