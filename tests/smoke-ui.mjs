// Обход всего сайта на ПК и телефоне: каждый раздел и вкладка открываются без ошибок, пустых экранов и
// сломанных запросов своего сайта. Запросы к чужим сайтам (погода, шрифты, Firebase) блокируются:
// игра обязана открываться и без них. Снимки — work/smoke/*.png.
//   SMOKE_PREVIEW=1 — проверять собранную версию (`npm run build` → vite preview), иначе — dev-сервер.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { initialState } from '../src/game.ts';

await mkdir('work/smoke', { recursive: true });
const preview = process.env.SMOKE_PREVIEW === '1';
const port = preview ? 4177 : 5191;
const vite = ['node_modules/vite/bin/vite.js', ...(preview ? ['preview'] : []), '--host', '127.0.0.1', '--port', String(port), '--strictPort'];
const server = spawn(process.execPath, vite, { stdio: ['ignore', 'pipe', 'pipe'] });
const url = `http://127.0.0.1:${port}/`;
const origin = new URL(url).origin;
const sameOrigin = (address) => {
  try { return new URL(address).origin === origin; } catch { return true; }
};

const seed = initialState();
seed.profile.onboardingComplete = true;
const seedJson = JSON.stringify(seed);

const desktopMenu = ['Главная', 'Сферы жизни', 'Мои задачи', 'Привычки', 'Цели', 'План жизни', 'Дерево навыков', 'Достижения', 'Магазин', 'Город', 'Профиль', 'Ключевые итоги'];
const mobileTabs = ['Главная', 'Привычки', 'Цели', 'Город'];
const mobileMore = ['Мои задачи', 'Сферы жизни', 'План жизни', 'Дерево навыков', 'Достижения', 'Магазин', 'Профиль', 'Ключевые итоги'];

let browser;
const problems = [];
try {
  let ready = false;
  for (const deadline = Date.now() + 40000; Date.now() < deadline && server.exitCode === null; ) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; }
    } catch { /* сервер ещё запускается */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Сервер не запустился (для SMOKE_PREVIEW=1 сначала выполните npm run build)');
  browser = await chromium.launch({ executablePath: process.env.LIFEGAME_CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });

  for (const mobile of [false, true]) {
    const device = mobile ? 'телефон' : 'ПК';
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      isMobile: mobile, hasTouch: mobile, timezoneId: 'Europe/Moscow',
    });
    // Только свой сайт: всё чужое недоступно.
    await context.route('**/*', (route) => (sameOrigin(route.request().url()) ? route.continue() : route.abort()));
    await context.addInitScript((json) => {
      try { if (!localStorage.getItem('play-your-life-v1')) localStorage.setItem('play-your-life-v1', json); } catch { /* хранилище недоступно */ }
    }, seedJson);
    const page = await context.newPage();
    let where = 'запуск';
    const fail = (text) => problems.push(`${device} · ${where}: ${text}`);
    page.on('pageerror', (error) => fail(`ошибка скрипта: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error' && sameOrigin(message.location().url || url)) fail(`console.error: ${message.text().slice(0, 300)}`);
    });
    page.on('requestfailed', (request) => {
      if (sameOrigin(request.url()) && !/ERR_ABORTED/.test(request.failure()?.errorText ?? '')) fail(`запрос не удался: ${request.url()} (${request.failure()?.errorText})`);
    });
    page.on('response', (response) => {
      if (sameOrigin(response.url()) && response.status() >= 400) fail(`ответ ${response.status()}: ${response.url()}`);
    });

    const shot = (name) => page.screenshot({ path: `work/smoke/${mobile ? 'mobile' : 'desktop'}-${name}.png` });
    const settle = async (pause = 250) => {
      await page.waitForTimeout(pause);
      const state = await page.evaluate(() => {
        const main = document.querySelector('main');
        return {
          text: main?.innerText.trim().length ?? 0,
          broken: !!document.querySelector('.error-boundary'),
          overflow: document.documentElement.scrollWidth - window.innerWidth,
        };
      });
      if (state.broken) fail('показано сообщение об ошибке раздела');
      if (state.text < 60) fail(`пустой экран (текста: ${state.text})`);
      if (mobile && state.overflow > 2) fail(`горизонтальная прокрутка на телефоне (+${state.overflow}px)`);
    };
    const click = async (scope, name) => {
      where = `${where.split(' → ')[0]} → ${name}`;
      await scope.getByRole('button', { name }).first().click();
      await settle();
    };
    const openMore = async () => {
      await page.locator('.pyl-tabbar').getByRole('button', { name: /^Ещё/ }).click();
      await page.locator('.pyl-more').waitFor();
    };
    const open = async (label) => {
      where = label;
      if (!mobile) await page.locator('.sidebar').getByRole('button', { name: new RegExp('^' + label) }).first().click();
      else if (mobileTabs.includes(label)) await page.locator('.pyl-tabbar').getByRole('button', { name: new RegExp('^' + label) }).first().click();
      else {
        await openMore();
        await page.locator('.pyl-more').getByRole('button', { name: new RegExp('^' + label) }).first().click();
        await page.locator('.pyl-more').waitFor({ state: 'hidden' });
      }
      await page.waitForFunction((text) => (document.querySelector('main h1')?.textContent ?? '').startsWith(text), label === 'Главная' ? 'Привет' : label, { timeout: 5000 }).catch(() => fail('заголовок раздела не появился'));
      await settle(400);
      await shot(String(Math.max(0, [...desktopMenu].indexOf(label)) + 1).padStart(2, '0'));
    };

    await page.goto(url);
    await page.getByRole('button', { name: 'Продолжить игру на этом устройстве' }).click();
    await page.waitForSelector('main h1', { state: 'attached' });
    await settle(500);

    for (const label of mobile ? [...mobileTabs, ...mobileMore] : desktopMenu) {
      await open(label);

      if (label === 'Сферы жизни') {
        await page.locator('.sph-open').first().click();
        await page.locator('.sph-scene').waitFor();
        await settle();
        for (const tab of ['Проекты', 'Задачи', 'Навыки', 'История', 'Статистика', 'Обзор']) {
          where = `Сферы жизни → ${tab}`;
          await page.locator('.sph-dock-tabs').getByRole('tab', { name: new RegExp('^' + tab) }).click();
          await settle();
        }
        where = 'Сферы жизни → Все сферы';
        await page.getByRole('button', { name: '← Все сферы' }).click();
        await settle();
      }
      if (label === 'Мои задачи') {
        for (const tab of ['Список', 'Календарь', 'Входящие']) await click(page.locator('main'), new RegExp('^' + tab));
        await click(page.locator('main'), /^Календарь/);
        for (const view of ['День', 'Неделя', '2 недели', 'Месяц', 'Неделя']) await click(page.getByRole('group', { name: 'Вид календаря' }), view);
        await click(page.locator('.tcal'), 'Вперёд');
        await click(page.locator('.tcal'), 'Назад');
      }
      if (label === 'Ключевые итоги') {
        for (const tab of ['Мои итоги', 'Динамика', 'Отчёт месяца']) {
          where = `Ключевые итоги → ${tab}`;
          await page.getByRole('tab', { name: new RegExp('^' + tab) }).click();
          await settle();
        }
      }
      if (label === 'Магазин') {
        for (const tab of ['Награда Люкс', 'Мои награды', 'Награды']) await click(page.locator('.shop-tabs'), new RegExp('^' + tab));
      }
      if (label === 'Дерево навыков') {
        const tabs = page.locator('.skt-spheres').getByRole('tab');
        for (let i = 1; i < Math.min(4, await tabs.count()); i++) {
          where = `Дерево навыков → сфера ${i + 1}`;
          await tabs.nth(i).click();
          await settle();
        }
      }
    }
    // Перезагрузка: игра возвращается на то же состояние, а не на пустой экран.
    where = 'перезагрузка';
    await page.reload();
    await page.getByRole('button', { name: 'Продолжить игру на этом устройстве' }).click();
    await page.waitForSelector('main h1', { state: 'attached' });
    await settle(500);
    await context.close();
  }
  assert.deepEqual([...new Set(problems)], [], 'Обход сайта нашёл проблемы');

  // Защита от белого экрана: «ломаем» один раздел и проверяем, что остальной сайт жив (только dev-сервер:
  // в сборке файлы разделов получают случайные имена).
  if (!preview) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/Moscow' });
    await context.route('**/*', (route) => (sameOrigin(route.request().url()) ? route.continue() : route.abort()));
    await context.route('**/src/components/HabitsPage.tsx*', (route) =>
      route.fulfill({ contentType: 'text/javascript', body: 'export default function Broken() { throw new Error("проверка защиты раздела"); }' }));
    await context.addInitScript((json) => {
      try { if (!localStorage.getItem('play-your-life-v1')) localStorage.setItem('play-your-life-v1', json); } catch { /* хранилище недоступно */ }
    }, seedJson);
    const page = await context.newPage();
    const uncaught = [];
    page.on('pageerror', (error) => uncaught.push(error.message));
    await page.goto(url);
    await page.getByRole('button', { name: 'Продолжить игру на этом устройстве' }).click();
    const menu = page.locator('.sidebar');
    await menu.getByRole('button', { name: /^Привычки/ }).click();
    await page.locator('.error-boundary').waitFor({ timeout: 5000 });
    assert.match(await page.locator('.error-boundary').innerText(), /Этот раздел не открылся/);
    assert.equal(await menu.isVisible(), true, 'Меню осталось на месте');
    await page.screenshot({ path: 'work/smoke/desktop-broken-section.png' });
    await page.getByRole('button', { name: 'Попробовать снова' }).click();
    await page.locator('.error-boundary').waitFor({ timeout: 5000 });
    await menu.getByRole('button', { name: /^Цели/ }).click();
    await page.waitForFunction(() => !document.querySelector('.error-boundary') && (document.querySelector('main h1')?.textContent ?? '').startsWith('Цели'), null, { timeout: 5000 });
    await menu.getByRole('button', { name: /^Главная/ }).click();
    await page.waitForFunction(() => (document.querySelector('main h1')?.textContent ?? '').startsWith('Привет'), null, { timeout: 5000 });
    assert.deepEqual(uncaught, [], 'Ошибка раздела не должна становиться необработанной');
    await context.close();
  }
  console.log(`Обход сайта (${preview ? 'сборка' : 'dev'}): ПК и телефон — все разделы открываются без ошибок`);
} finally {
  await browser?.close();
  server.kill();
}
