// «Ключевые итоги → Мои итоги»: ввод по сферам, подсказки, уверенность, мягкий режим, завершение. Снимки — work/month-report/*.png.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

await mkdir('work/month-report', { recursive: true });
const port = 5182;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
const url = `http://127.0.0.1:${port}/`;
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
    for (const theme of ['dark', 'light']) {
      const name = `${mobile ? 'mobile' : 'desktop'}-${theme}`;
      const context = await browser.newContext({
        viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
        isMobile: mobile, hasTouch: mobile, timezoneId: 'Europe/Moscow',
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(url);
      await page.evaluate(async (theme) => {
        const { initialState } = await import('/src/game.ts');
        const s = initialState();
        s.profile.onboardingComplete = true;
        const day = (n) => new Date(new Date().getFullYear(), new Date().getMonth(), n, 12).toISOString();
        s.events.push({ id: 'r1', sphere: 'health', title: 'Зарядка', xp: 120, date: day(1), kind: 'quest' }, { id: 'r2', sphere: 'sport', title: 'Бег', xp: 60, date: day(1), kind: 'quest' });
        s.activeDates.push(day(1).slice(0, 10));
        localStorage.setItem('play-your-life-v1', JSON.stringify(s));
        localStorage.setItem('play-your-life-home-theme', theme);
      }, theme);
      await page.reload();
      await page.getByRole('button', { name: 'Продолжить игру на этом устройстве' }).click();
      if (mobile) {
        await page.locator('.pyl-tabbar').getByRole('button', { name: /^Ещё/ }).click();
        await page.locator('.pyl-more').getByRole('button', { name: /Ключевые итоги/ }).click();
      } else {
        await page.locator('.sidebar').getByRole('button', { name: /^Ключевые итоги/ }).click();
      }
      await page.locator('.mrep').waitFor();
      assert.equal(await page.locator('.mrep-sphere').count(), 9, 'Девять сфер в отчёте');
      assert.ok(await page.locator('.mrep-kpis > div').count() === 5, 'Пять показателей');
      await page.getByRole('group', { name: 'Важность сферы Финансы от 1 до 5' }).getByRole('button', { name: '5 из 5' }).click();
      assert.equal(await page.getByRole('group', { name: 'Важность сферы Финансы от 1 до 5' }).locator('button.on').count(), 5, 'Важность сохранилась');
      await page.screenshot({ path: `work/month-report/${name}-1-report.png`, fullPage: true });
      await page.getByRole('button', { name: 'Подвести итог' }).first().click();
      await page.locator('.myr').waitFor();
      await page.screenshot({ path: `work/month-report/${name}-2-mine.png` });

      assert.deepEqual(errors, [], `Ошибки страницы: ${errors.join('; ')}`);
      await context.close();
    }
  }
} finally {
  await browser?.close();
  server.kill();
}
