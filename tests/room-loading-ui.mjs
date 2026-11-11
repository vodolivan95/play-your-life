// Медленная загрузка комнаты не блокирует выход; GPU и завершение загрузки не нужны.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5198/';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5198', '--strictPort'], { stdio: 'ignore' });
let browser;
const releaseRequests = [];
try {
  let ready = false;
  for (const deadline = Date.now() + 30000; Date.now() < deadline && server.exitCode === null;) {
    try { ready = (await fetch(url, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* Запуск. */ }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready);
  browser = await chromium.launch({ executablePath: process.env.LIFEGAME_CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    let releaseScene;
    const delayedScene = new Promise((resolve) => { releaseScene = resolve; });
    releaseRequests.push(releaseScene);
    await context.route('**/RoomScene3D.tsx*', async (route) => {
      await delayedScene;
      await route.abort();
    });
    // Нужна только положительная проверка возможности WebGL в RoomEngine.
    // Сама сцена задержана сетью: GPU не участвует в проверке слоёв и навигации.
    await context.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return type === 'webgl2' ? { getExtension: () => null } : original.call(this, type, ...args);
      };
    });
    const page = await context.newPage();
    await page.goto(`${url}?room-demo=sport`);
    await page.getByRole('heading', { name: 'Общая карта', exact: true }).waitFor();
    await page.locator('[data-building="sport"]').click();
    // Динамический модуль сцены задержан сетью: проверяем настоящий Suspense fallback,
    // не ожидая загрузки WebGL и не добавляя тестовые элементы в приложение.
    await page.locator('.room3d-hud').waitFor();
    await page.locator('.room3d-loading').waitFor();
    await page.getByRole('button', { name: 'Настройки комнаты', exact: true }).click({ timeout: 5000 });
    await page.getByRole('button', { name: 'Закрыть панель', exact: true }).click({ timeout: 5000 });
    const button = page.getByRole('button', { name: 'Вернуться из комнаты', exact: true });
    await button.click({ timeout: 5000 });
    await page.getByRole('heading', { name: 'Общая карта', exact: true }).waitFor();
    assert.equal(await page.locator('.room3d').count(), 0);
    releaseScene();
    await context.close();
    console.log(`Выход во время загрузки комнаты ${width}px — OK`);
  }
} finally {
  for (const release of releaseRequests) release();
  await browser?.close();
  server.kill();
}
