// Локальный регрессионный сценарий фокуса; внешние сервисы заблокированы.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { newAccountGame } from '../src/accountGame.ts';
import { saveCustomQuest } from '../src/personalQuests.ts';

const url = 'http://127.0.0.1:5197/';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5197', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  let ready = false;
  for (const deadline = Date.now() + 30000; Date.now() < deadline && server.exitCode === null;) {
    try { ready = (await fetch(url, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* Запуск Vite. */ }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Vite не запустился');
  await mkdir('work/focus', { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.LIFEGAME_CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, timezoneId: 'Europe/Moscow' });
    await context.route('**/*', (route) => route.request().url().startsWith(url) ? route.continue() : route.abort());
    let seed = newAccountGame('Аудит фокуса');
    seed.profile.onboardingComplete = true;
    seed = saveCustomQuest(seed, { name: 'Проверить сохранение фокуса', sphere: 'growth', difficulty: 'Micro' }, 'local');
    const id = seed.quests[0].id;
    await context.addInitScript((state) => {
      if (!localStorage.getItem('play-your-life-v1')) localStorage.setItem('play-your-life-v1', state);
    }, JSON.stringify(seed));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.clock.install();
    const open = async () => {
      if (page.url() === `${url}#/tasks/${id}`) await page.reload();
      else await page.goto(`${url}#/tasks/${id}`);
      await page.getByRole('button', { name: 'Продолжить игру на этом устройстве' }).click();
      await page.locator('.focus').waitFor();
    };
    await open();
    const focus = page.locator('.focus');
    await focus.getByRole('button', { name: 'Начать фокус', exact: true }).click();
    await focus.getByRole('button', { name: /Секундомер/ }).click();
    await focus.getByRole('button', { name: 'Начать фокус', exact: true }).click();
    await page.clock.fastForward(65000);
    await focus.getByRole('button', { name: 'Пауза', exact: true }).click();
    await page.waitForFunction(() => {
      const s = JSON.parse(localStorage.getItem('play-your-life-v1'));
      return s.focusSession?.segments.at(-1)?.end;
    });
    const paused = await page.evaluate(() => JSON.parse(localStorage.getItem('play-your-life-v1')).focusSession);
    await open();
    assert.equal(await focus.locator('.focus-state b').textContent(), 'На паузе');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('play-your-life-v1')).focusSession.id), paused.id);
    await focus.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await page.clock.fastForward(65000);
    await focus.getByRole('button', { name: 'Завершить сессию', exact: true }).click();
    await focus.getByRole('button', { name: 'Сохранить сессию', exact: true }).click();
    await page.waitForFunction(() => !JSON.parse(localStorage.getItem('play-your-life-v1')).focusSession);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('play-your-life-v1')));
    const records = saved.events.filter((e) => e.planningChange?.session);
    assert.equal(records.length, 1, 'сессия записывается один раз');
    assert.ok(records[0].planningChange.session.focusedSeconds >= 130);
    assert.ok(records[0].planningChange.session.focusedSeconds < 140);
    assert.equal(saved.quests[0].done, false, 'сессия не выполняет задачу');
    assert.equal(saved.xp, 0, 'фокус не начисляет XP');
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `work/focus/${width}.png`, fullPage: true });
    await context.close();
    console.log(`Фокус ${width}px: старт, пауза, перезагрузка, продолжение, однократное сохранение — OK`);
  }
} finally {
  await browser?.close();
  server.kill();
}
