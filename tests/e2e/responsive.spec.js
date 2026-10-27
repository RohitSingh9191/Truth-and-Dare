// Every screen on every kind of screen: tiny and foldable phones, common Android sizes,
// big phones, phones held sideways, tablets and a computer. Checks what a player would notice:
// nothing cut off, every button big enough for a thumb, the main buttons always on screen,
// card text that fits without scrolling, and names that never overlap.
// Screenshots: set SHOTS=<folder> to save one per device and screen.

import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';

const DEVICES = [
  { name: 'fold-cover-280x653', width: 280, height: 653 },
  { name: 'iphone-se1-320x568', width: 320, height: 568 },
  { name: 'android-360x640', width: 360, height: 640 },
  { name: 'android-360x800', width: 360, height: 800 },
  { name: 'iphone-se-375x667', width: 375, height: 667 },
  { name: 'iphone-390x844', width: 390, height: 844 },
  { name: 'pixel-412x915', width: 412, height: 915 },
  { name: 'promax-430x932', width: 430, height: 932 },
  { name: 'land-640x360', width: 640, height: 360 },
  { name: 'land-800x360', width: 800, height: 360 },
  { name: 'land-844x390', width: 844, height: 390 },
  { name: 'fold-open-673x841', width: 673, height: 841 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'tablet-1180x820', width: 1180, height: 820, mobile: false },
  { name: 'desktop-1366x768', width: 1366, height: 768, mobile: false },
];

const MIN_TAP = 40; // px; the design aims for 44
const MIN_CARD_FONT = 17; // px; card text must stay readable from across a table

const bank = (level) => JSON.parse(readFileSync(`content/questions/${level}.json`, 'utf8')).cards;
const longest = (cards, key) => cards.reduce((a, b) => ((b[key] || '').length > (a[key] || '').length ? b : a));
const friends = bank('friends');
const LONG_EN = longest(friends, 'en');
const LONG_HI = longest(friends, 'hi');
const TIMER = longest(friends.filter((c) => c.secs), 'en');
const NAMES_8 = ['Asha', 'Ben', 'Chen', 'Dev', 'Esha', 'Farhan', 'Gauri', 'Hamid'];
const NAMES_20 = ['Aishwarya', 'Bhavesh', 'Chitra', 'Dhruv', 'Ekaterina', 'Faizan', 'Gurpreet', 'Harshvardhan', 'Ishaan', 'Jasleen',
  'Karthikeyan', 'Lavanya', 'Mohammed', 'Nandini', 'Omkar', 'Priyanka', 'Quentin', 'Rajeshwari', 'Siddharth', 'Tanvi'];

/** Problems a player would see, inside the given part of the page. */
async function audit(page, scope = 'body') {
  return page.evaluate(({ scope, MIN_TAP }) => {
    const issues = [];
    const vw = innerWidth;
    const root = document.querySelector(scope);
    if (document.documentElement.scrollWidth > vw + 1) issues.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${vw})`);
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
      }
      return true;
    };
    const label = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}"`;
    for (const el of root.querySelectorAll('button, a[href], input:not([type=hidden]):not(.trap):not(.file), textarea, select')) {
      if (!visible(el) || el.closest('.trap')) continue;
      const r = el.getBoundingClientRect();
      if (el.matches('input[role=switch]')) continue; // the whole row is the tap target
      if (Math.min(r.width, r.height) < MIN_TAP && !el.matches('a:not(.btn)')) issues.push(`small tap target ${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      if (r.left < -1 || r.right > vw + 1) issues.push(`cut off at the side ${label(el)}`);
    }
    for (const el of root.querySelectorAll('h2, h3, p, span, li, label')) {
      if (!visible(el) || el.closest('.ring, svg')) continue;
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 || r.left < -1) issues.push(`text cut off at the side ${label(el)}`);
    }
    return issues;
  }, { scope, MIN_TAP });
}

async function onScreen(page, selector) {
  const box = await page.locator(selector).boundingBox();
  const { w, h } = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  return box && box.y >= -1 && box.y + box.height <= h + 1 && box.x >= -1 && box.x + box.width <= w + 1;
}

async function cardFits(page) {
  return page.evaluate(() => {
    const box = document.getElementById('cardMiddle');
    const p = document.getElementById('cardText');
    return { fits: box.scrollHeight <= box.clientHeight + 1, font: parseFloat(getComputedStyle(p).fontSize) };
  });
}

for (const d of DEVICES) {
  test.describe(d.name, () => {
    test.use({ viewport: { width: d.width, height: d.height }, isMobile: d.mobile !== false, hasTouch: d.mobile !== false });

    const dir = SHOTS_DIR(d.name);
    const shot = async (page, name) => { if (dir) await page.screenshot({ path: `${dir}/${name}.png` }); };

    test('main screen, spin, truth or dare', async ({ page }) => {
      await page.goto('/');
      expect(await audit(page)).toEqual([]);
      expect(await onScreen(page, '#spinBtn'), 'SPIN visible').toBe(true);
      await shot(page, '01-idle');
      await page.locator('#spinBtn').click();
      await expect(page.locator('#choice')).toBeVisible({ timeout: 8000 });
      expect(await audit(page)).toEqual([]);
      for (const sel of ['#truthBtn', '#dareBtn', '#againBtn']) expect(await onScreen(page, sel), `${sel} visible`).toBe(true);
      await shot(page, '02-choice');
    });

    for (const [key, card, lang] of [['long-en', LONG_EN, 'en'], ['long-hi', LONG_HI, 'hi'], ['timer', TIMER, 'en']]) {
      test(`card fits: ${key}`, async ({ page }) => {
        await page.addInitScript((l) => localStorage.setItem('ts1:settings', JSON.stringify({ gentle: true, lang: l, skip: 'forfeit' })), lang);
        await page.goto(`/?q=${card.id}`);
        await expect(page.locator('#card')).toBeVisible();
        await expect.poll(async () => (await cardFits(page)).fits, { message: 'card text fits without scrolling' }).toBe(true);
        const fit = await cardFits(page);
        expect(fit.font, 'card text readable').toBeGreaterThanOrEqual(MIN_CARD_FONT);
        expect(await audit(page, '#card')).toEqual([]);
        for (const sel of ['#doneBtn', '#skipBtn', '#backBtn', '#turnBtn']) expect(await onScreen(page, sel), `${sel} visible`).toBe(true);
        await shot(page, `03-card-${key}`);
        if (key === 'timer') {
          // A skip with a forfeit adds a note: still fits.
          await page.locator('#skipBtn').click();
          await expect.poll(async () => (await cardFits(page)).fits, { message: 'card with forfeit note fits' }).toBe(true);
          await shot(page, '04-card-forfeit');
        }
      });
    }

    test('big text and Hinglish still fit', async ({ page }) => {
      await page.addInitScript((id) => localStorage.setItem('ts1:settings', JSON.stringify({ gentle: true, lang: 'hi', big: true })), LONG_HI.id);
      await page.goto(`/?q=${LONG_HI.id}`);
      await expect(page.locator('#card')).toBeVisible();
      await expect.poll(async () => (await cardFits(page)).fits).toBe(true);
      const fit = await cardFits(page);
      expect(fit.font).toBeGreaterThanOrEqual(MIN_CARD_FONT);
      expect(await audit(page, '#card')).toEqual([]);
      await page.locator('#doneBtn').click();
      expect(await audit(page)).toEqual([]);
      expect(await onScreen(page, '#spinBtn')).toBe(true);
      await shot(page, '05-big-hinglish');
    });

    for (const [key, names] of [['8', NAMES_8], ['20', NAMES_20]]) {
      test(`${key} names never overlap and the bottle never covers one`, async ({ page }) => {
        await page.addInitScript((n) => localStorage.setItem('ts1:names', JSON.stringify(n)), names);
        await page.goto('/');
        await expect(page.locator('.seat')).toHaveCount(names.length);
        const layout = await page.evaluate(() => {
          const stage = document.getElementById('stage').getBoundingClientRect();
          const seats = [...document.querySelectorAll('.seat')].map((s) => s.getBoundingClientRect());
          const b = document.getElementById('bottle').getBoundingClientRect();
          const cx = b.left + b.width / 2;
          const cy = b.top + b.height / 2;
          const reach = (document.getElementById('bottle').offsetHeight * 154) / 260;
          let overlap = 0;
          let outside = 0;
          let covered = 0;
          seats.forEach((a, i) => {
            if (a.left < stage.left - 1 || a.right > stage.right + 1 || a.top < stage.top - 1 || a.bottom > stage.bottom + 1) outside++;
            // Names sit on top of the bottle; the straw may reach a name but never pass its middle.
            if (Math.hypot(a.left + a.width / 2 - cx, a.top + a.height / 2 - cy) < reach - 2) covered++;
            seats.slice(i + 1).forEach((c) => {
              if (a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom) overlap++;
            });
          });
          const font = parseFloat(getComputedStyle(document.querySelector('.seat')).fontSize);
          return { overlap, outside, covered, font, bottle: document.getElementById('bottle').offsetHeight };
        });
        expect(layout.overlap, 'names overlap').toBe(0);
        expect(layout.outside, 'names off the screen').toBe(0);
        expect(layout.covered, 'names under the bottle').toBe(0);
        expect(layout.font, 'names readable').toBeGreaterThanOrEqual(11);
        expect(layout.bottle, 'bottle big enough to see').toBeGreaterThanOrEqual(80);
        await page.locator('#spinBtn').click();
        await expect(page.locator('#choice')).toBeVisible({ timeout: 8000 });
        expect(await audit(page)).toEqual([]);
        await shot(page, `06-names-${key}`);
      });
    }

    for (const [key, open] of [
      ['levels', async (p) => p.locator('#levelBtn').click()],
      ['settings', async (p) => p.locator('#menuBtn').click()],
      ['names', async (p) => p.locator('#namesBtn').click()],
      ['feedback', async (p) => p.locator('#feedbackBtn').click()],
    ]) {
      test(`${key} sheet fits`, async ({ page }) => {
        await page.goto('/');
        await open(page);
        const sheet = page.locator('dialog.sheet[open]');
        await expect(sheet).toBeVisible();
        await page.waitForTimeout(300);
        const box = await sheet.boundingBox();
        const vh = await page.evaluate(() => innerHeight);
        expect(box.y, 'sheet top on screen').toBeGreaterThanOrEqual(-1);
        expect(box.y + box.height, 'sheet bottom on screen').toBeLessThanOrEqual(vh + 1);
        expect(await audit(page, 'dialog.sheet[open]')).toEqual([]);
        expect(await onScreen(page, 'dialog.sheet[open] .sheet-x'), 'close button visible').toBe(true);
        await shot(page, `07-sheet-${key}`);
      });
    }

    test('adding a question with the keyboard open', async ({ page }) => {
      test.skip(d.mobile === false || d.width > d.height, 'phones held upright only');
      await page.goto('/');
      await page.locator('#addBtn').click();
      const box = page.getByRole('textbox', { name: 'Your question' });
      await box.click();
      // The keyboard takes about 40% of an upright phone screen; Android shrinks the page.
      await page.setViewportSize({ width: d.width, height: Math.round(d.height * 0.58) });
      await page.waitForTimeout(300);
      await box.fill('Who in this room makes the best chai?');
      await box.scrollIntoViewIfNeeded();
      expect(await onScreen(page, 'dialog.sheet[open] textarea'), 'typing box visible').toBe(true);
      const sheet = await page.locator('dialog.sheet[open]').boundingBox();
      expect(sheet.y + sheet.height).toBeLessThanOrEqual(Math.round(d.height * 0.58) + 1);
      await page.getByRole('button', { name: 'Save', exact: true }).scrollIntoViewIfNeeded();
      expect(await onScreen(page, 'dialog.sheet[open] .btn.primary'), 'Save reachable').toBe(true);
      await shot(page, '08-keyboard');
    });
  });
}

function SHOTS_DIR(name) {
  if (!process.env.SHOTS) return null;
  const dir = `${process.env.SHOTS}/${name}`;
  mkdirSync(dir, { recursive: true });
  return dir;
}

test.describe('level name in the header', () => {
  for (const width of [280, 320, 360, 390]) {
    test(`is not cut short at ${width} px (Kids & Family, English and Hinglish)`, async ({ page }) => {
      test.skip(width < 330, 'tiny screens may shorten long level names');
      await page.setViewportSize({ width, height: 740 });
      for (const lang of ['en', 'hi']) {
        await page.addInitScript((l) => { localStorage.setItem('ts1:settings', JSON.stringify({ gentle: true, lang: l })); localStorage.setItem('ts1:level', '"kids"'); }, lang);
        await page.goto('/');
        const cut = await page.evaluate(() => { const n = document.getElementById('levelName'); return n.scrollWidth > n.clientWidth + 1; });
        expect(cut, `${lang}: "Kids & Family" shortened`).toBe(false);
      }
    });
  }
});
