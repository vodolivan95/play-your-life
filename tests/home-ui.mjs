// Только локальная фикстура, внешние Firebase/TickTick/погода заблокированы.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { newAccountGame } from '../src/accountGame.ts';
import { saveGoal, saveTask } from '../src/planning.ts';
import { toggleMonthlyFocus } from '../src/monthlyFocus.ts';

let seed = newAccountGame('Тест главной');
seed.profile.onboardingComplete = true;
for (const name of ['Фокус А', 'Фокус Б', 'Фокус В', 'Запасная цель']) {
  seed = saveGoal(seed, { name, sphere: 'health', target: 100, reward: 100, progressMode: 'tasks' });
}
const ids = seed.goals.map(goal => goal.id);
seed = saveTask(seed, { name: 'Шаг фокуса А', sphere: 'health', difficulty: 'Simple', goalId: ids[0] });
for (const id of ids.slice(0, 3)) seed = toggleMonthlyFocus(seed, id);
const seedJson = JSON.stringify(seed);
const port = 5194;
const url = `http://127.0.0.1:${port}/`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.on('data', () => {});
server.stderr.on('data', () => {});
let browser;
try {
  let ready = false;
  for (const deadline = Date.now() + 40000; Date.now() < deadline && server.exitCode === null;) {
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch { /* Vite запускается. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Vite не запустился');
  browser = await chromium.launch({ executablePath: process.env.LIFEGAME_CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'Europe/Moscow', reducedMotion: 'reduce' });
    await context.route('**/*', route => new URL(route.request().url()).origin === new URL(url).origin ? route.continue() : route.abort());
    await context.addInitScript(json => {
      if (!localStorage.getItem('play-your-life-v1')) localStorage.setItem('play-your-life-v1', json);
    }, seedJson);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const enter = async () => {
      await page.getByRole('button', { name: 'Продолжить игру на этом устройстве' }).click();
      await page.locator('.home-dashboard').waitFor();
    };
    await page.goto(url);
    await enter();
    assert.equal(await page.locator('.home-focus, .home-player, .home-spheres, .home-main-goal, .home-reward, .home-schedule, .home-habits').count(), 0);
    assert.equal(await page.locator('.account-bar').count(), 0, 'Панели аккаунта нет на главной');
    assert.equal(await page.locator('.home-today, .home-streak').count(), 2);
    assert.equal(await page.locator('.hys-sphere-row').count(), 10);
    assert.equal(await page.locator('.peak-focus-switch button').count(), 3);
    await page.getByRole('button', { name: 'Главный проект 2: Фокус Б', exact: true }).click();
    assert.match(await page.locator('.peak-card-goal').innerText(), /Фокус Б/);
    assert.equal(await page.getByRole('button', { name: 'Главный проект 2: Фокус Б', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Открыть проект', exact: true }).click();
    await page.locator('.gw-banner h2').filter({ hasText: 'Фокус Б' }).waitFor();
    await page.locator('.gw-banner-tools summary').click();
    await page.getByRole('button', { name: 'Убрать из главных проектов месяца', exact: true }).click();
    await page.waitForFunction(id => !JSON.parse(localStorage.getItem('play-your-life-v1')).monthlyFocus.goalIds.includes(id), ids[1]);
    // После снятия третье место свободно, можно назначить другой проект.
    await page.evaluate(id => { location.hash = `/goals/${id}`; }, ids[3]);
    await page.locator('.gw-banner h2').filter({ hasText: 'Запасная цель' }).waitFor();
    await page.locator('.gw-banner-tools summary').click();
    await page.getByRole('button', { name: 'Сделать главным проектом месяца', exact: true }).click();
    await page.waitForFunction(id => JSON.parse(localStorage.getItem('play-your-life-v1')).monthlyFocus.goalIds.includes(id), ids[3]);
    await page.evaluate(id => { location.hash = `/goals/${id}`; }, ids[1]);
    await page.locator('.gw-banner h2').filter({ hasText: 'Фокус Б' }).waitFor();
    await page.locator('.gw-banner-tools summary').click();
    assert.equal(await page.getByRole('button', { name: 'Сделать главным проектом месяца', exact: true }).isDisabled(), true, 'Четвёртая цель запрещена');
    // Аккаунт только в профиле, после возврата сохраняется новый выбор.
    await page.evaluate(() => { location.hash = '#profile'; });
    await page.locator('.profile-account .account-bar').waitFor();
    assert.equal(await page.locator('.account-bar').count(), 1);
    await page.evaluate(() => { location.hash = ''; });
    await page.locator('.home-dashboard').waitFor();
    assert.equal(await page.locator('.account-bar').count(), 0);
    await page.getByRole('button', { name: 'Главный проект 1: Фокус А', exact: true }).click();
    await page.getByRole('button', { name: 'Показать задачу', exact: true }).click();
    await page.locator('.twin').waitFor();
    assert.equal(await page.locator('.twin').getByLabel('Название', { exact: true }).inputValue(), 'Шаг фокуса А');
    await page.locator('.twin').getByRole('button', { name: 'Закрыть', exact: true }).click();
    await page.evaluate(() => { location.hash = ''; window.dispatchEvent(new HashChangeEvent('hashchange')); });
    await page.locator('.home-dashboard').waitFor();
    for (const theme of ['light', 'dark']) {
      await page.evaluate(async theme => {
        const { setMenuTheme } = await import('/src/menuTheme.ts');
        setMenuTheme(theme);
      }, theme);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Нет горизонтальной прокрутки ${width}px ${theme}`);
    }
    await page.reload();
    await enter();
    assert.match(await page.locator('.peak-focus-switch').innerText(), /Запасная цель/);
    assert.equal(await page.locator('.peak-focus-switch button').filter({ hasText: 'Фокус Б' }).count(), 0);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`Главная ${width}px: блоки, переключение, меню, лимит, профиль, задача, сохранение — OK`);
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
