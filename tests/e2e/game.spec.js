import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';

const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

const bank = (level) => JSON.parse(readFileSync(`content/questions/${level}.json`, 'utf8')).cards;

async function spinToChoice(page) {
  await page.locator('#spinBtn').click();
  await expect(page.locator('#choice')).toBeVisible({ timeout: 8000 });
}

async function openCard(page, which = '#truthBtn') {
  await spinToChoice(page);
  await page.locator(which).click();
  await expect(page.locator('#card')).toBeVisible();
  return (await page.locator('#cardText').textContent()).trim();
}

test('the bottle is ready on the first screen, two taps to the first question', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#bottle')).toBeVisible();
  await expect(page.locator('#levelName')).toHaveText('Friends');
  await shot(page, '01-first-screen');

  await spinToChoice(page);
  await expect(page.locator('#pickLine')).toHaveText(/^Part \d+: truth or dare\?$/);
  await shot(page, '02-truth-or-dare');

  await page.locator('#truthBtn').click();
  await expect(page.locator('#cardType')).toHaveText(/truth/i);
  await expect(page.locator('#timerBtn')).toBeHidden();
  const first = (await page.locator('#cardText').textContent()).trim();
  expect(bank('friends').some((c) => c.en === first && c.type === 'truth')).toBe(true);
  await shot(page, '03-truth-card');

  await page.locator('#skipBtn').click();
  const second = (await page.locator('#cardText').textContent()).trim();
  expect(second).not.toBe(first);

  await page.locator('#switchBtn').click();
  await expect(page.locator('#cardType')).toHaveText(/dare/i);
  await shot(page, '04-dare-card');

  await page.locator('#backBtn').click();
  await expect(page.locator('#cardText')).toHaveText(second);

  await page.locator('#doneBtn').click();
  await expect(page.locator('#card')).toBeHidden();
  await expect(page.locator('#spinBtn')).toBeVisible();
});

test.describe('full animation', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('a spin slows down like a real bottle (about 4 to 5 seconds) and a swipe also spins', async ({ page }) => {
    await page.goto('/');
    const t0 = Date.now();
    await spinToChoice(page);
    const took = Date.now() - t0;
    expect(took).toBeGreaterThan(3300);
    expect(took).toBeLessThan(7000);
    await shot(page, '05-beam');

    await page.locator('#againBtn').click();
    await expect(page.locator('#choice')).toBeVisible({ timeout: 8000 });
    await page.locator('#dareBtn').click();
    await page.locator('#doneBtn').click();

    const box = await page.locator('#stage').boundingBox();
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5, { steps: 3 });
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.7, { steps: 3 });
    await page.mouse.up();
    await expect(page.locator('body')).toHaveAttribute('data-phase', 'spinning');
    await expect(page.locator('#choice')).toBeVisible({ timeout: 8000 });
  });
});

test('the phone Back button closes the card instead of leaving the game', async ({ page }) => {
  await page.goto('/');
  await openCard(page);
  await page.goBack();
  await expect(page.locator('#card')).toBeHidden();
  await expect(page.locator('#spinBtn')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
});

test('names sit around the bottle and the picked name lights up', async ({ page }) => {
  await page.goto('/');
  await page.locator('#namesBtn').click();
  const input = page.getByRole('textbox', { name: 'Add a name' });
  for (const n of ['Asha', 'Ben', 'Chen', 'Dev']) {
    await input.fill(n);
    await input.press('Enter');
  }
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.seat')).toHaveCount(4);
  await spinToChoice(page);
  const picked = await page.locator('.seat.picked').textContent();
  expect(['Asha', 'Ben', 'Chen', 'Dev']).toContain(picked);
  await expect(page.locator('#pickLine')).toHaveText(`${picked}: truth or dare?`);
  await shot(page, '06-names');
  await page.locator('#dareBtn').click();
  await expect(page.locator('#cardPlayer')).toHaveText(picked);
});

test('with Fair turns off the bottle picks names at random; on, everyone plays once per round', async ({ page }) => {
  test.setTimeout(150_000);
  const names = ['Asha', 'Ben', 'Chen', 'Dev'];
  const spins = async (count) => {
    const picks = [];
    for (let i = 0; i < count; i++) {
      await page.locator(picks.length || (await page.locator('#choice').isVisible()) ? '#againBtn' : '#spinBtn').click();
      await expect(page.locator('body')).toHaveAttribute('data-phase', 'choice', { timeout: 8000 });
      await expect(page.locator('.seat.picked')).toHaveCount(1);
      picks.push(await page.locator('.seat.picked').textContent());
    }
    return picks;
  };
  const fairSwitch = () => page.getByRole('switch', { name: /Fair turns/ });

  await page.goto('/');
  await page.locator('#namesBtn').click();
  const input = page.getByRole('textbox', { name: 'Add a name' });
  for (const n of names) {
    await input.fill(n);
    await input.press('Enter');
  }
  await expect(fairSwitch()).toBeChecked(); // on by default
  await fairSwitch().uncheck();
  await page.getByRole('button', { name: 'Close' }).click();

  const random = await spins(40);
  for (let i = 1; i < random.length; i++) expect(random[i], 'never the same name twice in a row').not.toBe(random[i - 1]);
  for (const n of names) expect(random, `${n} gets picked`).toContain(n);
  // Fair rounds would give all 4 names in every block of 4 turns. At random that happens only
  // about 2 times in 9, so some block must miss someone (all 10 full by chance: 1 in 3 million).
  const blocks = Array.from({ length: 10 }, (_, b) => new Set(random.slice(b * 4, b * 4 + 4)).size);
  expect(blocks.some((size) => size < 4), `not in rounds: ${random.join(' ')}`).toBe(true);

  // The choice is remembered after the game is closed and opened again.
  await page.reload();
  await page.locator('#namesBtn').click();
  await expect(fairSwitch()).not.toBeChecked();

  // Switched back on: every 4 turns, all 4 names, with no one twice in a row.
  await fairSwitch().check();
  await page.getByRole('button', { name: 'Close' }).click();
  const fair = await spins(12);
  for (let b = 0; b < 3; b++) expect(new Set(fair.slice(b * 4, b * 4 + 4)).size, `round ${b + 1}: ${fair.join(' ')}`).toBe(4);
  for (let i = 1; i < fair.length; i++) expect(fair[i]).not.toBe(fair[i - 1]);
  console.log(`Fair off: ${random.join(' ')}\nFair on:  ${fair.join(' ')}`);
});

test('18+ levels ask for age, and heat 3 asks everyone to agree', async ({ page }) => {
  await page.goto('/');
  await page.locator('#levelBtn').click();
  await expect(page.locator('.level-row')).toHaveCount(4); // Spicy is hidden until switched on
  await shot(page, '07-levels');
  await page.locator('.level-row', { hasText: 'Couples' }).locator('.level-main').click();
  await expect(page.getByText('Is everyone playing 18 or older?')).toBeVisible();
  await page.getByRole('button', { name: 'Yes, everyone is 18+' }).click();
  await expect(page.locator('#levelName')).toHaveText('Couples');
  await expect(page.locator('#heatBadge .flame')).toHaveCount(1);

  await page.locator('#levelBtn').click();
  await page.locator('.level-row', { hasText: 'Couples' }).locator('.heat-row button').nth(2).click();
  await expect(page.getByText('Very hot: are you sure?')).toBeVisible();
  await page.getByRole('button', { name: 'Yes, we all agree' }).click();
  await expect(page.locator('#heatBadge .flame')).toHaveCount(3);

  const text = await openCard(page);
  const card = bank('couples').find((c) => c.en === text);
  expect(card?.heat).toBe(3);
  await page.locator('#doneBtn').click();

  // Opening the game again asks again.
  await page.reload();
  await page.locator('#spinBtn').click();
  await expect(page.getByText('Is everyone playing 18 or older?')).toBeVisible();
  await page.getByRole('button', { name: 'No', exact: true }).click();
  await expect(page.locator('#levelName')).toHaveText('Friends');
});

test('Spicy appears only after it is switched on and the age check is passed', async ({ page }) => {
  await page.goto('/');
  await page.locator('#levelBtn').click();
  await expect(page.locator('.level-row', { hasText: 'Spicy' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Show Spicy (18+)' }).click();
  await page.getByRole('button', { name: 'Yes, everyone is 18+' }).click();
  await expect(page.locator('.level-row', { hasText: 'Spicy' })).toHaveCount(1);
  await page.locator('.level-row', { hasText: 'Spicy' }).locator('.heat-row button').nth(1).click();
  await expect(page.locator('#levelName')).toHaveText('Spicy');
  const text = await openCard(page, '#dareBtn');
  expect(bank('spicy').find((c) => c.en === text)?.heat).toBe(2);
});

test('Family mode starts on Kids, hides adult levels and needs a hold to switch off', async ({ page }) => {
  await page.goto('/');
  await page.locator('#menuBtn').click();
  await page.getByRole('switch', { name: /Family mode/ }).click();
  await expect(page.locator('#levelName')).toHaveText('Kids & Family');
  await page.getByRole('switch', { name: /Family mode/ }).click();
  await expect(page.getByText('Hold the button for 2 seconds.')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).last().click();
  await expect(page.getByRole('switch', { name: /Family mode/ })).toBeChecked();
  await page.getByRole('button', { name: 'Close' }).click();
  await shot(page, '08-kids');
  await page.locator('#levelBtn').click();
  await expect(page.locator('.level-row')).toHaveCount(2);
});

test('Hinglish shows Hinglish screen text and cards', async ({ page }) => {
  await page.goto('/');
  await page.locator('#langBtn').click();
  await expect(page.locator('#langBtn')).toHaveText('HI');
  await expect(page.locator('.hint')).toHaveText('Phone beech mein: sab apne paas wala number le lein. Phir bottle ko tap ya swipe kariye.');
  const text = await openCard(page);
  expect(bank('friends').some((c) => c.hi === text)).toBe(true);
  await shot(page, '09-hinglish-card');
});

test('own questions are saved and can be played on their own', async ({ page }) => {
  await page.goto('/');
  await page.locator('#addBtn').click();
  await page.getByRole('textbox', { name: 'Your question' }).fill('Who in this room makes the best chai?');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('#toast')).toContainText('Saved on this phone');
  await page.locator('#menuBtn').click();
  await page.getByRole('button', { name: 'My questions' }).click();
  await page.getByRole('radio', { name: 'Only mine' }).click();
  await page.keyboard.press('Escape');
  const text = await openCard(page);
  expect(text).toBe('Who in this room makes the best chai?');
});

test('Report hides the card and waits to send only the card number and reason', async ({ page }) => {
  await page.goto('/');
  const text = await openCard(page);
  const id = bank('friends').find((c) => c.en === text).id;
  await page.locator('#reportBtn').click();
  await page.getByRole('button', { name: 'Unsafe' }).click();
  await expect(page.locator('#cardText')).not.toHaveText(text);
  const outbox = await page.evaluate(() => JSON.parse(localStorage.getItem('ts1:outbox')));
  expect(outbox.some((i) => i.k === 'vote' && i.id === id && i.v === 'report' && i.r === 'unsafe')).toBe(true);
  expect(JSON.stringify(outbox)).not.toMatch(/name|email|phone/i);
});

test('group rounds come every few turns', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ts1:settings', JSON.stringify({ group: 'often' })));
  await page.goto('/');
  for (let i = 0; i < 3; i++) {
    await openCard(page);
    await page.locator('#doneBtn').click();
  }
  await expect(page.locator('#card')).toBeVisible();
  await expect(page.locator('#cardType')).toHaveText(/would you rather|never have i ever|most likely to/i);
  await expect(page.locator('#cardPlayer')).toHaveText('Group round: Everyone plays');
  await expect(page.locator('#switchBtn')).toBeHidden();
  await shot(page, '10-group-round');
});

test('a shared card link opens that card', async ({ page }) => {
  const card = bank('friends')[3];
  await page.goto(`/?q=${card.id}&ref=card`);
  await expect(page.locator('#card')).toBeVisible();
  await expect(page.locator('#cardText')).toHaveText(card.en);
});

test('the game works offline after the first visit', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#bottle')).toBeVisible();
  const text = await openCard(page);
  expect(text.length).toBeGreaterThan(10);
  await context.setOffline(false);
});

test.describe('small phone', () => {
  test.use({ viewport: { width: 360, height: 640 } });
  test('no sideways scrolling and the main buttons fit', async ({ page }) => {
    await page.goto('/');
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
    expect(sw).toBeLessThanOrEqual(iw);
    await expect(page.locator('#spinBtn')).toBeInViewport();
    await shot(page, '11-small-phone');
    await page.locator('#menuBtn').click();
    await shot(page, '12-settings');
  });
});

test.describe('light theme', () => {
  test('light theme looks right', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ts1:settings', JSON.stringify({ theme: 'light' })));
    await page.goto('/');
    await shot(page, '13-light');
    await openCard(page, '#dareBtn');
    await shot(page, '14-light-card');
  });
});

test('Back closes only the top layer, one at a time, then stays in the game', async ({ page }) => {
  await page.goto('/');
  await page.locator('#menuBtn').click();
  await page.getByRole('button', { name: 'Reset seen questions' }).click();
  await expect(page.getByText('Start all questions fresh?')).toBeVisible();
  await page.goBack();
  await expect(page.getByText('Start all questions fresh?')).toBeHidden();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  await page.goBack();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe('/');
  // Two questions in a row (age check, then heat 3) and Back still works.
  await page.locator('#levelBtn').click();
  await page.locator('.level-row', { hasText: 'Couples' }).locator('.heat-row button').nth(2).click();
  await page.getByRole('button', { name: 'Yes, everyone is 18+' }).click();
  await page.getByRole('button', { name: 'Yes, we all agree' }).click();
  await expect(page.locator('#heatBadge .flame')).toHaveCount(3);
  await page.waitForTimeout(600);
  await page.locator('#spinBtn').click();
  await expect(page.locator('#choice')).toBeVisible({ timeout: 8000 });
  await page.locator('#truthBtn').click();
  await expect(page.locator('#card')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#card')).toBeHidden();
  await expect(page.locator('#spinBtn')).toBeVisible();
});


test('without names, the circle has 12 numbered parts and the bottle stops inside the lit one', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#parts .part')).toHaveCount(12);
  await expect(page.locator('#partNums .part-num')).toHaveText(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
  await expect(page.locator('.hint')).toContainText('number nearest them');
  let last = null;
  for (let round = 0; round < 4; round++) {
    await page.locator(round ? '#againBtn' : '#spinBtn').click();
    await expect(page.locator('#choice')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#parts .part.on')).toHaveCount(1);
    const result = await page.evaluate(() => {
      const on = [...document.querySelectorAll('#parts .part')].findIndex((p) => p.classList.contains('on'));
      const deg = parseFloat(document.getElementById('bottle').style.transform.match(/rotate\(([-0-9.e]+)deg\)/)[1]);
      const a = ((deg % 360) + 360) % 360;
      const centre = on * 30;
      const d = Math.min(Math.abs(a - centre), 360 - Math.abs(a - centre));
      return { on, d };
    });
    expect(result.d, 'bottle points inside the lit part').toBeLessThan(15 * 0.6);
    await expect(page.locator('#pickLine')).toHaveText(`Part ${result.on + 1}: truth or dare?`);
    if (last != null) expect(Math.min(Math.abs(result.on - last), 12 - Math.abs(result.on - last))).toBeGreaterThan(1);
    last = result.on;
    if (round === 0) await shot(page, '15-parts');
  }
  await page.locator('#truthBtn').click();
  await expect(page.locator('#cardPlayer')).toHaveText(`Part ${last + 1}`);
});

test('the number of parts can be changed or switched off, and names replace them', async ({ page }) => {
  await page.goto('/');
  await page.locator('#menuBtn').click();
  await page.getByRole('radio', { name: '8', exact: true }).click();
  await expect(page.locator('#parts .part')).toHaveCount(8);
  await page.getByRole('radio', { name: 'Off', exact: true }).first().click();
  await expect(page.locator('#parts .part')).toHaveCount(0);
  await page.getByRole('radio', { name: '12', exact: true }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('#parts .part')).toHaveCount(12);
  await page.locator('#namesBtn').click();
  const input = page.getByRole('textbox', { name: 'Add a name' });
  for (const n of ['Asha', 'Ben', 'Chen']) { await input.fill(n); await input.press('Enter'); }
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('#parts .part')).toHaveCount(0);
  await expect(page.locator('.seat')).toHaveCount(3);
});
