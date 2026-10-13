// Единая тема: переключатель меняет оформление всех разделов. Снимки — work/theme/*.png.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

await mkdir('work/theme', { recursive: true });
const port = 5177;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
const url = `http://127.0.0.1:${port}/`;
const pages = ['Главная', 'Сферы жизни', 'Мои задачи', 'Привычки', 'Цели', 'План жизни', 'Skill Tree', 'Достижения', 'Магазин', 'Город', 'Профиль', 'Ключевые итоги'];
let browser;
try {
  let ready = false;
  for (const deadline = Date.now() + 30000; Date.now() < deadline && server.exitCode === null; ) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; }
    } catch { /* Vite ещё запускается */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Vite не запустился');
  browser = await chromium.launch({ executablePath: process.env.LIFEGAME_CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      isMobile: mobile, hasTouch: mobile, timezoneId: 'Europe/Moscow',
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url);
    await page.evaluate(async () => {
      const { initialState } = await import('/src/game.ts');
      const s = initialState();
      s.profile.onboardingComplete = true;
      localStorage.setItem('play-your-life-v1', JSON.stringify(s));
    });
    await page.reload();
    await page.getByRole('button', { name: 'Продолжить игру на этом устройстве' }).click();
    await page.waitForTimeout(500);
    const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
    const bodyLight = () => page.evaluate(() => {
      const [r, g, b] = (getComputedStyle(document.body).backgroundImage.match(/rgba?\((\d+), (\d+), (\d+)/) ?? [0, 255, 255, 255]).slice(1).map(Number);
      return (r + g + b) / 3 > 128;
    });
    assert.equal(await theme(), 'dark', 'По умолчанию тёмная тема на всём приложении');

    for (const name of ['dark', 'light']) {
      if (mobile) {
        await page.locator('.pyl-tabbar').getByRole('button', { name: /^Ещё/ }).click();
        await page.getByRole('button', { name: name === 'dark' ? 'Тёмная тема' : 'Светлая тема' }).click();
        await page.locator('.pyl-more-backdrop').click({ position: { x: 20, y: 20 } });
      } else {
        await page.locator('.sidebar .pyl-theme').getByRole('button', { name: name === 'dark' ? 'Тёмная' : 'Светлая' }).click();
      }
      assert.equal(await theme(), name);
      assert.equal(await bodyLight(), name === 'light', `Фон страницы соответствует теме ${name}`);
      const list = mobile ? ['Главная', 'Привычки', 'Цели', 'Город'] : pages;
      for (const [i, label] of list.entries()) {
        const nav = mobile ? page.locator('.pyl-tabbar') : page.locator('.sidebar');
        await nav.getByRole('button', { name: new RegExp('^' + label) }).first().click();
        await page.waitForTimeout(700);
        await page.screenshot({ path: `work/theme/${mobile ? 'mobile' : 'desktop'}-${name}-${String(i + 1).padStart(2, '0')}.png`, fullPage: !mobile });
      }
      if (mobile) {
        await page.locator('.pyl-tabbar').getByRole('button', { name: /^Ещё/ }).click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: `work/theme/mobile-${name}-more.png` });
        await page.locator('.pyl-more-backdrop').click({ position: { x: 20, y: 20 } });
      }
    }
    // Выбор темы сохраняется после перезагрузки.
    await page.reload();
    await page.waitForTimeout(500);
    assert.equal(await theme(), 'light');
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('Тема меняется во всех разделах');
} finally {
  await browser?.close();
  server.kill();
}
