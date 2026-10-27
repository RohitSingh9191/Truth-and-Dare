// Menus: levels, names, settings, about, Family mode lock and the iPhone install tip.

import { t, cardText } from './i18n.js';
import { h, icon, sheet, toast, segmented, toggleRow, ask } from './ui.js';
import { LEVEL, HEATS, visibleLevels } from './levels.js';
import * as deck from './deck.js';
import { canVibrate } from './sound.js';
import { myQuestionsSheet } from './custom.js';
import { CONFIG } from './config.js';
import { cleanText } from '../shared/validate.js';

const flames = (n) => h('span', { class: 'flames', 'aria-hidden': 'true' }, [...Array(n)].map(() => icon('flame', 'flame')));
const ageLabel = (l) => (l.age === 'all' ? t('allAges') : l.age);

// ---------- Levels ----------

export function levelSheet(app) {
  const { settings, S } = app;
  const box = h('div', { class: 'levels' });

  const render = () => {
    box.replaceChildren();
    for (const l of visibleLevels(settings)) {
      const current = l.key === S.level;
      const heat = app.heatOf(l.key);
      const sample = deck.sampleCard(l.key);
      const left = deck.isLoaded(l.key) ? deck.newCount(l.key, heat, settings.family) : null;
      box.append(h('div', { class: `level-row${current ? ' current' : ''}`, style: { '--lvl': l.color, '--lvl-ink': l.ink } },
        h('button', { class: 'level-main', type: 'button', 'aria-pressed': String(current), onclick: () => pick(l.key, heat) },
          h('span', { class: 'level-title' }, t(`level_${l.key}`), h('span', { class: 'age' }, ageLabel(l))),
          h('span', { class: 'level-desc' }, t(`desc_${l.key}`)),
          sample && !l.adult && h('span', { class: 'level-sample' }, `“${cardText(sample)}”`),
          left != null && h('span', { class: 'level-left' }, t('newCards', { n: left })),
        ),
        l.heat && h('div', { class: 'heat-row', role: 'radiogroup', 'aria-label': t('heat') },
          HEATS.map((x) => h('button', {
            type: 'button', role: 'radio', class: current && heat === x ? 'on' : '',
            'aria-checked': String(current && heat === x),
            onclick: () => pick(l.key, x),
          }, flames(x), h('span', {}, t(`heat${x}_${l.key}`))))),
      ));
    }
    if (settings.family) box.append(h('p', { class: 'fine' }, t('familyNote')));
    else if (!settings.spicy) {
      box.append(h('button', { class: 'btn ghost', type: 'button', onclick: enableSpicy }, t('showSpicy')));
    }
  };

  async function enableSpicy() {
    if (!(await app.confirmAdult())) return;
    app.setSetting('spicy', true);
    render();
  }

  async function pick(key, heat) {
    if (await app.selectLevel(key, heat)) s.close();
    else render();
  }

  render();
  const s = sheet(t('chooseLevel'), box);
  Promise.allSettled(visibleLevels(settings).map((l) => deck.loadLevel(l.key))).then(() => { if (s.dialog.open) render(); });
}

// ---------- Names ----------

export function namesSheet(app) {
  const names = [...app.S.names];
  const input = h('input', { type: 'text', maxlength: 16, autocomplete: 'off', enterkeyhint: 'done', placeholder: t('namePlaceholder'), 'aria-label': t('addName') });
  const list = h('ol', { class: 'names-list' });
  const err = h('p', { class: 'error', 'aria-live': 'polite' });

  const commit = () => { app.setNames([...names]); render(); };
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= names.length) return; [names[i], names[j]] = [names[j], names[i]]; commit(); };

  function render() {
    list.replaceChildren(...names.map((n, i) => h('li', {},
      h('span', { class: 'name' }, n),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('moveUp'), disabled: i === 0, onclick: () => move(i, -1) }, icon('up')),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('moveDown'), disabled: i === names.length - 1, onclick: () => move(i, 1) }, icon('down')),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('delete'), onclick: () => { names.splice(i, 1); commit(); } }, icon('x')),
    )));
    err.textContent = names.length === 1 ? t('namesMin') : '';
  }

  const add = (e) => {
    e?.preventDefault();
    const v = cleanText(input.value).slice(0, 16);
    if (!v) return;
    if (names.length >= 20) { err.textContent = t('namesMax'); return; }
    names.push(v);
    input.value = '';
    commit();
    input.focus();
  };

  render();
  sheet(t('names'), [
    h('p', { class: 'lead' }, t('namesLead')),
    h('form', { class: 'inline-form', onsubmit: add }, input, h('button', { class: 'btn primary', type: 'submit' }, t('add'))),
    err,
    list,
    toggleRow(t('fairTurns'), app.settings.fair, (v) => { app.setSetting('fair', v); app.S.seats = { queue: [], last: -1 }; }, t('fairNote')),
    names.length > 0 && h('button', { class: 'btn ghost', type: 'button', onclick: () => { names.length = 0; commit(); } }, t('clearNames')),
    h('p', { class: 'fine' }, t('namesPrivacy')),
  ]);
  setTimeout(() => input.focus(), 60);
}

// ---------- Family mode lock ----------

function familyOffCheck(settings) {
  return new Promise((resolve) => {
    let ok = false;
    if (settings.pin) {
      const input = h('input', { type: 'password', inputmode: 'numeric', maxlength: 4, autocomplete: 'off', 'aria-label': t('pin') });
      const err = h('p', { class: 'error', 'aria-live': 'polite' });
      const s = sheet(t('familyOffTitle'), [
        h('p', { class: 'lead' }, t('enterPin')),
        h('form', {
          class: 'stack',
          onsubmit: (e) => { e.preventDefault(); if (input.value === settings.pin) { ok = true; s.close(); } else err.textContent = t('wrongPin'); },
        }, input, err, h('button', { class: 'btn primary', type: 'submit' }, t('continue'))),
      ], { onClose: () => resolve(ok), className: 'small' });
      setTimeout(() => input.focus(), 60);
      return;
    }
    let timer;
    const hold = h('button', { class: 'btn primary hold', type: 'button' }, h('span', {}, t('holdToTurnOff')));
    const start = (e) => {
      e.preventDefault();
      hold.classList.add('holding');
      timer = setTimeout(() => { ok = true; s.close(); }, 2000);
    };
    const stop = () => { hold.classList.remove('holding'); clearTimeout(timer); };
    hold.addEventListener('pointerdown', start);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => hold.addEventListener(ev, stop));
    hold.addEventListener('contextmenu', (e) => e.preventDefault());
    const s = sheet(t('familyOffTitle'), [h('p', { class: 'lead' }, t('holdLead')), hold], { onClose: () => { stop(); resolve(ok); }, className: 'small' });
  });
}

function pinSheet(app) {
  const input = h('input', { type: 'password', inputmode: 'numeric', maxlength: 4, autocomplete: 'off', 'aria-label': t('pin') });
  const err = h('p', { class: 'error', 'aria-live': 'polite' });
  const s = sheet(t('setPin'), [
    h('p', { class: 'lead' }, t('pinLead')),
    h('form', {
      class: 'stack',
      onsubmit: (e) => {
        e.preventDefault();
        if (!/^\d{4}$/.test(input.value)) { err.textContent = t('pinFormat'); return; }
        app.setSetting('pin', input.value);
        s.close();
        toast(t('pinSaved'));
      },
    }, input, err, h('button', { class: 'btn primary', type: 'submit' }, t('save'))),
  ], { className: 'small' });
  setTimeout(() => input.focus(), 60);
}

// ---------- Settings ----------

export function settingsSheet(app) {
  const { settings } = app;
  const section = (title, ...rows) => h('section', { class: 'set-section' }, h('h3', {}, title), ...rows);
  const body = h('div');

  const render = () => {
    const gentleNow = settings.gentle === true;
    body.replaceChildren(
      section(t('setGame'),
        h('p', { class: 'label' }, t('language')),
        segmented([{ value: 'en', label: 'English' }, { value: 'hi', label: 'Hinglish' }], settings.lang, (v) => { app.setSetting('lang', v); s.dialog.setAttribute('aria-label', t('settings')); s.dialog.querySelector('h2').textContent = t('settings'); render(); }, t('language')),
        h('p', { class: 'label' }, t('partsSetting')),
        segmented([0, 6, 8, 12].map((v) => ({ value: v, label: v ? String(v) : t('parts_0') })), Number(settings.parts), (v) => app.setSetting('parts', v), t('partsSetting')),
        h('small', { class: 'note' }, t('partsNote')),
        h('p', { class: 'label' }, t('groupRounds')),
        segmented(['off', 'sometimes', 'often'].map((v) => ({ value: v, label: t(`group_${v}`) })), settings.group, (v) => app.setSetting('group', v), t('groupRounds')),
        h('small', { class: 'note' }, t('groupNote')),
        h('p', { class: 'label' }, t('skipRule')),
        segmented(['free', 'limited', 'forfeit'].map((v) => ({ value: v, label: t(`skip_${v}`) })), settings.skip, (v) => app.setSetting('skip', v), t('skipRule')),
        h('small', { class: 'note' }, t('skipNote')),
        h('p', { class: 'label' }, t('mineMode')),
        segmented(['mixed', 'only', 'builtin'].map((v) => ({ value: v, label: t(`mine_${v}`) })), settings.mine, (v) => app.setSetting('mine', v), t('mineMode')),
      ),
      section(t('setLevels'),
        toggleRow(t('familyMode'), settings.family, async (on, _e, input) => {
          if (on) {
            app.setSetting('family', true);
            app.setLevel('kids');
            toast(t('familyOn'));
          } else if (await familyOffCheck(settings)) {
            settings.pin = '';
            app.setSetting('family', false);
          } else input.checked = true;
          render();
        }, t('familyModeNote')),
        settings.family && h('div', { class: 'indent' },
          h('button', { class: 'btn ghost', type: 'button', onclick: () => pinSheet(app) }, settings.pin ? t('changePin') : t('setPin')),
          toggleRow(t('familyOwn'), settings.familyOwn, (v) => app.setSetting('familyOwn', v)),
        ),
        !settings.family && toggleRow(t('spicyToggle'), settings.spicy, async (on, _e, input) => {
          if (on && !(await app.confirmAdult())) { input.checked = false; return; }
          app.setSetting('spicy', on);
        }, t('spicyNote')),
      ),
      section(t('setSoundLook'),
        toggleRow(t('soundSetting'), settings.sound, (v) => app.setSetting('sound', v)),
        canVibrate() && toggleRow(t('vibrateSetting'), settings.vibrate, (v) => app.setSetting('vibrate', v), t('vibrateNote')),
        toggleRow(t('gentleSpin'), gentleNow, (v) => app.setSetting('gentle', v), t('gentleNote')),
        toggleRow(t('bigText'), settings.big, (v) => app.setSetting('big', v)),
        toggleRow(t('lightTheme'), settings.theme === 'light', (v) => app.setSetting('theme', v ? 'light' : 'dark')),
      ),
      section(t('setMore'),
        h('div', { class: 'stack' },
          h('button', { class: 'btn', type: 'button', onclick: () => { s.close(); myQuestionsSheet(app.customCtx()); } }, icon('list'), t('myQuestions')),
          h('button', { class: 'btn', type: 'button', onclick: () => { s.close(); app.openFeedback(); } }, icon('chat'), t('feedback')),
          h('button', { class: 'btn', type: 'button', onclick: () => app.invite() }, icon('whatsapp'), t('invite')),
          !app.isInstalled() && h('button', { class: 'btn', type: 'button', onclick: () => { s.close(); installSheet(app); } }, icon('download'), t('installApp')),
          h('button', {
            class: 'btn', type: 'button',
            onclick: async () => {
              if (await ask(t('resetTitle'), t('resetLead'), t('reset'), t('cancel'))) { deck.resetSeen(); toast(t('resetDone')); }
            },
          }, icon('refresh'), t('resetSeen')),
          h('button', { class: 'btn', type: 'button', onclick: () => { s.close(); aboutSheet(); } }, icon('info'), t('about')),
          h('a', { class: 'btn', href: '/truth-and-dare-questions/' }, icon('list'), t('questionLists')),
          h('a', { class: 'btn', href: '/privacy.html' }, icon('lock'), t('privacy')),
        ),
      ),
      h('p', { class: 'fine center credit' }, `Truth n Dare ${CONFIG.version} · ${t('developedBy')}`),
    );
  };
  render();
  const s = sheet(t('settings'), body);
}

// ---------- About and how to play ----------

export function aboutSheet() {
  sheet(t('about'), [
    h('h3', {}, t('howTitle')),
    h('ol', { class: 'how' }, [1, 2, 3, 4].map((i) => h('li', {}, t(`how${i}`)))),
    h('p', { class: 'lead' }, t('freePass')),
    h('h3', {}, t('levelsTitle')),
    h('ul', { class: 'about-levels' }, Object.values(LEVEL).map((l) => h('li', { style: { '--lvl': l.color } },
      h('strong', {}, t(`level_${l.key}`)), ` (${ageLabel(l)}): ${t(`desc_${l.key}`)}`))),
    h('h3', {}, t('pickTitle')),
    h('p', {}, t('pickText')),
    h('h3', {}, t('safetyTitle')),
    h('p', {}, t('safetyText')),
    h('h3', {}, t('contactTitle')),
    h('p', {}, t('contactText'), ' ', h('a', { href: `mailto:${CONFIG.contactEmail}` }, CONFIG.contactEmail)),
    h('p', {}, h('a', { href: '/privacy.html' }, t('privacy'))),
    h('p', { class: 'fine center credit' }, `Truth n Dare ${CONFIG.version} · ${t('developedBy')}`),
  ]);
}

// ---------- Get the app (install on phone or computer) ----------

function device() {
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return 'ios';
  if (/android/i.test(ua)) return 'android';
  if (/firefox/i.test(ua)) return 'firefox';
  if (/safari/i.test(ua) && !/chrome|chromium|edg/i.test(ua)) return 'mac-safari';
  return 'desktop';
}

const STEPS = {
  ios: ['installIos1', 'installIos2', 'installIos3'],
  android: ['installAndroid1', 'installAndroid2'],
  desktop: ['installDesktop1', 'installDesktop2'],
  'mac-safari': ['installMacSafari1'],
  firefox: ['installFirefox1'],
};

export function installSheet(app) {
  const here = device();
  const steps = (key) => h('ol', { class: 'how' }, STEPS[key].map((k) => h('li', {}, t(k))));
  const others = Object.keys(STEPS).filter((k) => k !== here && k !== 'mac-safari' && k !== 'firefox');
  const s = sheet(t('getAppTitle'), [
    h('p', { class: 'lead' }, t('getAppLead')),
    app.canInstall()
      ? h('button', {
        class: 'btn primary', type: 'button', style: { width: '100%' },
        onclick: async () => { if (await app.install()) s.close(); },
      }, icon('download'), t('installNow'))
      : [h('h3', {}, t(`installOn_${here}`)), steps(here)],
    h('details', { class: 'other-devices' },
      h('summary', {}, t('installOther')),
      others.map((k) => [h('h3', {}, t(`installOn_${k}`)), steps(k)])),
    h('p', { class: 'fine' }, t('getAppNote')),
  ]);
}

export function iosTip() {
  sheet(t('iosTitle'), [
    h('ol', { class: 'how' }, h('li', {}, t('ios1')), h('li', {}, t('ios2')), h('li', {}, t('ios3'))),
  ], { className: 'small' });
}
