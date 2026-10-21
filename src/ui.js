// Small DOM helpers: element builder, bottom sheets, toasts and the phone's Back button.

import { t } from './i18n.js';

/** h('button', { class: 'x', onclick }, 'text', child) — text is always set safely. */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function icon(name, cls = 'i') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

// ---------- On-screen keyboard ----------
// Android shrinks the page when the keyboard opens (see the viewport tag). iPhones don't, so we
// read the visible height and lift open sheets above the keyboard ourselves.

const vv = window.visualViewport;
function syncViewport() {
  if (!vv) return;
  const root = document.documentElement.style;
  const zoomed = vv.scale > 1.01; // pinch-zoom: leave the layout alone
  root.setProperty('--vvh', `${zoomed ? innerHeight : vv.height}px`);
  root.setProperty('--kb', `${zoomed ? 0 : Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop))}px`);
}
vv?.addEventListener('resize', () => {
  syncViewport();
  // When the keyboard opens, keep the box being typed in visible.
  const el = document.activeElement;
  if (el?.matches?.('input, textarea') && el.closest('dialog')) setTimeout(() => el.scrollIntoView({ block: 'center' }), 50);
});
vv?.addEventListener('scroll', syncViewport);
syncViewport();

// ---------- Layers and the Back button ----------
// While any sheet or card is open we keep one extra history entry, so the phone's Back button
// closes the top layer instead of leaving the game. One entry for all layers (not one each)
// avoids races between closing one layer and opening the next.

const layers = [];
let guard = false; // our history entry is in place
let ignorePops = 0; // pops caused by our own history.back()
let backTimer = null;

function addGuard() {
  if (guard) return;
  try { history.pushState({ truthspin: 1 }, ''); guard = true; } catch { /* ignore */ }
}

window.addEventListener('popstate', () => {
  if (ignorePops > 0) {
    ignorePops--;
    if (layers.length) { guard = false; addGuard(); }
    return;
  }
  guard = false; // the player pressed Back
  const top = layers.pop();
  if (top) { top.viaBack = true; top.close(); }
  if (layers.length) addGuard();
});

export function openLayer(dialog, { onClose } = {}) {
  const layer = { dialog, viaBack: false, close: () => dialog.close() };
  layers.push(layer);
  if (backTimer) { clearTimeout(backTimer); backTimer = null; } // reuse the entry
  addGuard();
  dialog.addEventListener('close', () => {
    const i = layers.indexOf(layer);
    if (i >= 0) layers.splice(i, 1);
    if (!layers.length && guard && !layer.viaBack) {
      // Wait a moment: another layer often opens right away (next question, group round).
      backTimer = setTimeout(() => {
        backTimer = null;
        if (layers.length || !guard) return;
        guard = false;
        ignorePops++;
        history.back();
      }, 400);
    }
    onClose?.(dialog.returnValue);
  }, { once: true });
  dialog.showModal();
  return layer;
}

export const anyLayerOpen = () => layers.length > 0;

/**
 * A bottom sheet with a title and content. Returns { dialog, body, close }.
 * The sheet is removed from the page when closed.
 */
export function sheet(title, content, { onClose, className = '' } = {}) {
  const body = h('div', { class: 'sheet-body' }, content);
  const closeBtn = h('button', { class: 'icon-btn sheet-x', type: 'button', 'aria-label': t('close'), onclick: () => dialog.close() }, icon('x'));
  // The title takes focus when the sheet opens: screen readers announce it, and no button looks pressed.
  const head = h('div', { class: 'sheet-head' }, h('h2', { tabindex: '-1', autofocus: true }, title), closeBtn);
  const dialog = h('dialog', { class: `sheet ${className}`, 'aria-label': title }, head, body);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); }); // tap outside
  dragToClose(dialog, head);
  document.body.append(dialog);
  openLayer(dialog, {
    onClose: (v) => {
      onClose?.(v);
      setTimeout(() => dialog.remove(), 300);
    },
  });
  return { dialog, body, close: (v) => dialog.close(v) };
}

/** Pull a sheet down by its top bar to close it, like a phone's own bottom sheets. */
function dragToClose(dialog, head) {
  let drag = null;
  head.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || e.target.closest('button')) return;
    drag = { id: e.pointerId, y: e.clientY, t: performance.now(), dy: 0 };
    head.setPointerCapture?.(e.pointerId);
    dialog.style.transition = 'none';
  });
  head.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dy = Math.max(0, e.clientY - drag.y);
    dialog.style.transform = `translateY(${drag.dy}px)`;
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { dy, t } = drag;
    drag = null;
    dialog.style.transition = 'transform 0.18s ease-out';
    const fast = dy / Math.max(1, performance.now() - t) > 0.5;
    if (dy > 90 || (fast && dy > 30)) {
      dialog.style.transform = 'translateY(100%)';
      setTimeout(() => dialog.close(), 150);
    } else dialog.style.transform = '';
  };
  head.addEventListener('pointerup', end);
  head.addEventListener('pointercancel', end);
}

/** A yes/no question. Resolves true or false. */
export function ask(title, text, yes, no) {
  return new Promise((resolve) => {
    let answer = false;
    const s = sheet(title, [
      text && h('p', { class: 'lead' }, text),
      h('div', { class: 'stack' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => { answer = true; s.close(); } }, yes),
        h('button', { class: 'btn', type: 'button', onclick: () => s.close() }, no),
      ),
    ], { onClose: () => resolve(answer), className: 'small' });
  });
}

// ---------- Toasts ----------

let toastTimer;
export function toast(text, action) {
  let box = document.getElementById('toast');
  if (!box) {
    box = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(box);
  }
  box.replaceChildren(h('span', {}, text));
  if (action) {
    box.append(h('button', { type: 'button', onclick: () => { hideToast(); action.run(); } }, action.label));
  }
  // Toasts must show above open dialogs, which live in the top layer.
  const open = document.querySelectorAll('dialog[open]');
  const top = open[open.length - 1];
  if (top && box.parentElement !== top) top.append(box);
  else if (!top && box.parentElement !== document.body) document.body.append(box);
  box.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, action ? 5000 : 2600);
}

function hideToast() {
  document.getElementById('toast')?.classList.remove('show');
}

/** Segmented choice: [{ value, label }] → element; calls onPick(value). */
export function segmented(options, value, onPick, label) {
  const group = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
  for (const o of options) {
    const b = h('button', {
      type: 'button', role: 'radio', class: o.value === value ? 'on' : '',
      'aria-checked': String(o.value === value),
      onclick: () => {
        group.querySelectorAll('button').forEach((x) => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
        b.classList.add('on');
        b.setAttribute('aria-checked', 'true');
        onPick(o.value);
      },
    }, o.label);
    group.append(b);
  }
  return group;
}

/** Opens the keyboard straight away only on computers; on touch screens players see the whole form first. */
export function focusSoon(el) {
  if (matchMedia('(pointer: fine)').matches) setTimeout(() => el.focus(), 60);
}

/** A labelled on/off switch row. */
export function toggleRow(label, checked, onChange, note) {
  const input = h('input', { type: 'checkbox', role: 'switch', checked: !!checked });
  input.addEventListener('change', (e) => onChange(input.checked, e, input));
  return h('label', { class: 'row-toggle' },
    h('span', { class: 'row-text' }, h('span', {}, label), note && h('small', {}, note)),
    input,
  );
}
