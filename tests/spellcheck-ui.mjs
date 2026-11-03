import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

await mkdir('work', { recursive: true });
execFileSync(process.execPath, ['scripts/build-spell-dictionaries.mjs'], { stdio: 'inherit' });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5178', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
let browser;

async function openTasks(page, mobile) {
  if (mobile) {
    await page.locator('.pyl-tabbar').getByRole('button', { name: /^Ещё/ }).click();
    await page.locator('.pyl-more').getByRole('button', { name: /^Мои задачи/ }).click();
  } else {
    await page.locator('.sidebar').getByRole('button', { name: /^Мои задачи/ }).click();
  }
}

async function replaceWord(page, field, word, expected, diagnostics) {
  const fieldId = `spellcheck-test-${expected}`;
  await field.evaluate((element, id) => { element.id = id; }, fieldId);
  await field.fill(word);
  try {
    await page.waitForFunction(value => Array.from(document.querySelectorAll('.spellcheck-error-word')).some(node => node.textContent === value), word, { timeout: 30000 });
  } catch (error) {
    console.error('Spellcheck diagnostics:', await page.evaluate(() => ({ fields: Array.from(document.querySelectorAll('input,textarea')).map(el => ({ tag: el.tagName, type: el.type, spellcheck: el.getAttribute('spellcheck'), active: el === document.activeElement, color: getComputedStyle(el).color, value: el.value })), overlay: Boolean(document.querySelector('.spellcheck-mirror')), popup: document.querySelector('.spellcheck-popover')?.textContent, workerError: document.documentElement.dataset.spellcheckError })), 'page/worker errors:', diagnostics.errors, 'worker and dictionary requests:', diagnostics.responses);
    throw error;
  }
  const underline = page.locator('.spellcheck-error-word').filter({ hasText: word }).first();
  const underlineStyle = await underline.evaluate(node => ({ style: getComputedStyle(node).textDecorationStyle, color: getComputedStyle(node).textDecorationColor }));
  assert.equal(underlineStyle.style, 'wavy', 'Ошибочное слово должно подчёркиваться волнистой линией');
  assert.equal(underlineStyle.color, 'rgb(220, 38, 38)', 'Подчёркивание должно быть красным');
  assert.equal(await field.inputValue(), word, 'Подсветка не должна менять исходный текст до выбора замены');
  const [fieldBox, overlayBox] = await Promise.all([field.boundingBox(), page.locator('.spellcheck-mirror').boundingBox()]);
  assert.ok(fieldBox && overlayBox, 'Поле и mirror overlay должны быть видимы');
  for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(fieldBox[key] - overlayBox[key]) < 2, `Overlay должен совпадать с полем (${key})`);
  if (diagnostics.view && word === 'projct') await page.screenshot({ path: `work/spellcheck-${diagnostics.view}.png` });
  await field.evaluate((element, value) => {
    const start = element.value.indexOf(value) + Math.max(1, value.length - 1);
    element.setSelectionRange(start, start);
    const rect = element.getBoundingClientRect();
    element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: rect.left + 20, clientY: rect.top + 12 }));
  }, word);
  const suggestion = page.locator('.spellcheck-suggestion').filter({ hasText: new RegExp(`^${expected}$`) });
  await suggestion.waitFor({ timeout: 15000 });
  await suggestion.click();
  await page.waitForFunction(({ id, value }) => document.getElementById(id)?.value === value, { id: fieldId, value: expected });
  assert.equal(await field.inputValue(), expected, 'Выбранная замена должна сохраниться в поле');
}

try {
  let output = '';
  server.stdout.on('data', chunk => { output += String(chunk); });
  server.stderr.on('data', chunk => { output += String(chunk); });
  const deadline = Date.now() + 30000;
  let ready = false;
  while (Date.now() < deadline && server.exitCode === null) {
    try {
      const response = await fetch('http://127.0.0.1:5178/', { signal: AbortSignal.timeout(1000) });
      if (response.ok) { ready = true; break; }
    } catch { /* Vite is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, `Vite не запустился: ${output}`);
  browser = await chromium.launch({ executablePath: process.env.LIFEGAME_CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    const errors = [];
    const responses = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
    page.on('requestfailed', request => { if (request.url().startsWith('http://127.0.0.1:5178/')) errors.push(`request failed: ${request.url()} ${request.failure()?.errorText}`); });
    page.on('response', response => { if (/spellcheck|worker/i.test(response.url())) responses.push(`${response.status()} ${response.url()}`); });
    page.on('worker', worker => responses.push(`worker started: ${worker.url()}`));
    await page.goto('http://127.0.0.1:5178/');
    await page.evaluate(async () => {
      const { newAccountGame } = await import('/src/accountGame.ts');
      const state = newAccountGame('Игрок');
      state.profile.onboardingComplete = true;
      localStorage.setItem('play-your-life-v1', JSON.stringify(state));
    });
    await page.reload();
    await page.getByRole('button', { name: 'Продолжить игру на этом устройстве' }).click();
    await openTasks(page, mobile);
    await page.getByRole('button', { name: '＋ Новая задача' }).first().click();
    const dialog = page.locator('.pyl-quest-dialog');
    const title = dialog.getByLabel('Название задачи');
    await replaceWord(page, title, 'projct', 'project', { errors, responses, view: mobile ? 'mobile' : 'desktop' });

    const comments = dialog.locator('textarea').first();
    await replaceWord(page, comments, 'превет', 'привет', { errors, responses });
    assert.deepEqual(errors, [], `Ошибки браузера на ${mobile ? 'телефоне' : 'desktop'}`);
    await context.close();
  }
  console.log('Кастомная spellcheck проверена на desktop и phone: RU/EN ошибки подчёркнуты красным, замены применяются к React-controlled полям.');
} finally {
  await browser?.close();
  server.kill();
}
