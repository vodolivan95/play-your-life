// «Ключевые итоги → Мои итоги»: ввод по сферам, подсказки, уверенность, мягкий режим, завершение. Снимки — work/key-results/*.png.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

await mkdir('work/key-results', { recursive: true });
const port = 5181;
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
      await page.getByRole('tab', { name: /^Мои итоги/ }).click();
      await page.locator('.myr').waitFor();
      assert.ok(await page.locator('.myr-hint').count() > 5, 'Подсказки включены по умолчанию');

      // Подсказки выключаются переключателем.
      await page.getByRole('switch', { name: 'Подсказки' }).evaluate((el) => el.click());
      assert.equal(await page.locator('.myr-hint').count(), 0, 'Подсказки скрыты');
      await page.getByRole('switch', { name: 'Подсказки' }).evaluate((el) => el.click());
      assert.ok(await page.locator('.myr-hint').count() > 5);

      // Текст сферы → задача → низкая уверенность → шаг поменьше.
      const sphere = page.locator('.myr-sphere').first();
      await sphere.getByPlaceholder('Одна главная вещь и первый шаг').fill('Пробежать 10 км');
      await sphere.getByRole('button', { name: /Превратить в задачу/ }).click();
      await sphere.getByRole('group', { name: 'Уверенность от 1 до 10' }).getByRole('button', { name: '5', exact: true }).click();
      await sphere.getByText(/Ниже 7/).waitFor();
      await page.screenshot({ path: `work/key-results/${name}-1-sphere.png`, fullPage: true });
      await sphere.getByRole('button', { name: 'Взять шаг поменьше' }).click();
      assert.equal(await sphere.getByLabel('Название задачи').inputValue(), 'Пробежать 6 км');

      // Оценка 2 звезды предлагает мягкий режим.
      await page.getByRole('button', { name: '2 из 5' }).click();
      await page.getByRole('button', { name: 'Включить мягкий режим' }).click();
      await page.getByText('Тяжёлые месяцы бывают у всех').waitFor();
      assert.equal(await page.locator('.myr-sphere').count(), 0, 'В мягком режиме сферы скрыты');
      await page.getByPlaceholder(/10 минут прогулки/).fill('10 минут прогулки');
      await page.screenshot({ path: `work/key-results/${name}-2-soft.png`, fullPage: true });
      await page.getByRole('button', { name: 'Закончить мягко' }).click();
      await page.waitForTimeout(300);

      assert.deepEqual(errors, [], `Ошибки страницы: ${errors.join('; ')}`);
      await context.close();
    }
  }
} finally {
  await browser?.close();
  server.kill();
}
