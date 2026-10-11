// «Сферы жизни»: карточки районов, окно сферы и открытая сфера в обеих темах. Снимки — work/spheres/*.png.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

await mkdir('work/spheres', { recursive: true });
const port = 5178;
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
        s.events.push({ id: 'ui-health', sphere: 'health', title: 'Утренняя зарядка', xp: 20, date: new Date().toISOString(), kind: 'quest' });
        localStorage.setItem('play-your-life-v1', JSON.stringify(s));
        localStorage.setItem('play-your-life-home-theme', theme);
      }, theme);
      await page.reload();
      await page.getByRole('button', { name: 'Продолжить игру на этом устройстве' }).click();
      if (mobile) {
        await page.locator('.pyl-tabbar').getByRole('button', { name: /^Ещё/ }).click();
        await page.locator('.pyl-more').getByRole('button', { name: /Сферы жизни/ }).click();
      } else {
        await page.locator('.sidebar').getByRole('button', { name: /^Сферы жизни/ }).click();
      }
      const cards = page.locator('.sph-card');
      await cards.first().waitFor();
      assert.equal(await cards.count(), 9, 'Девять районов');
      await page.waitForTimeout(600);
      await page.screenshot({ path: `work/spheres/${name}-1-overview.png`, fullPage: true });

      // Фильтр «Есть задачи» оставляет только районы с задачами на сегодня.
      await page.getByRole('button', { name: 'Есть задачи', exact: true }).click();
      const withTasks = await cards.count();
      assert.ok(withTasks > 0 && withTasks < 9, `Фильтр по задачам: ${withTasks}`);
      await page.getByRole('button', { name: 'Все', exact: true }).click();
      assert.equal(await cards.count(), 9);

      // Окно сферы из паутины и закрытие по Esc.
      const label = page.locator('button.radar-label').first();
      await label.scrollIntoViewIfNeeded();
      await label.click();
      const quick = page.getByRole('dialog', { name: /^Сфера / });
      await quick.waitFor();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `work/spheres/${name}-2-quick.png` });
      await page.keyboard.press('Escape');
      await quick.waitFor({ state: 'detached' });

      // Окно из карточки → «Открыть район».
      await cards.first().locator('.sph-card-photo').click();
      await quick.getByRole('button', { name: 'Открыть район' }).click();
      await page.locator('.sph-hero').waitFor();
      assert.equal(await page.getByRole('tab', { name: 'Обзор' }).getAttribute('aria-selected'), 'true');
      await page.waitForTimeout(600);
      await page.screenshot({ path: `work/spheres/${name}-3-sphere.png`, fullPage: true });
      for (const [tab, file] of [[/^Проекты/, '4-projects'], ['Навыки', '5-skills']]) {
        await page.getByRole('tab', { name: tab }).click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: `work/spheres/${name}-${file}.png`, fullPage: true });
      }
      await page.getByRole('button', { name: '← Все сферы' }).click();
      await cards.first().waitFor();
      assert.deepEqual(errors, []);
      await context.close();
    }
  }
  console.log('Сферы жизни: карточки, окно и открытая сфера работают');
} finally {
  await browser?.close();
  server.kill();
}
