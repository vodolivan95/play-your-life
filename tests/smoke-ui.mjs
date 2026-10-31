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
if (process.env.SMOKE_PLAN_ONLY === '1') {
  const start = new Date();
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 5);
  const at = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T09:00:00`;
  const goalId = 'mobile-plan-smoke-goal';
  const stageId = 'mobile-plan-smoke-stage';
  seed.goals = [{
    ...seed.goals[0],
    id: goalId,
    name: 'Мобильная проверка длинного направления и переноса текста',
    sphere: 'health',
    current: 0,
    target: 100,
    startsAt: at(start),
    dueAt: at(end),
    stages: [{ id: stageId, name: 'Проверить сроки, диаграмму и перенос длинных названий', status: 'active', startsAt: at(start), dueAt: at(end) }],
  }];
  seed.quests = [{
    ...seed.quests[0],
    id: 'mobile-plan-smoke-task',
    name: 'Проверить задачи, этапы и длинные подписи на маленьком экране',
    sphere: 'health',
    done: false,
    goalId,
    stageId,
    startsAt: at(start),
    dueAt: at(end),
    estimateMinutes: 45,
  }];
}
const seedJson = JSON.stringify(seed);

const desktopMenu = ['Главная', 'Сферы жизни', 'Мои задачи', 'Привычки', 'Цели', 'Финансы', 'Дерево навыков', 'Достижения', 'Магазин', 'Город', 'Профиль', 'Ключевые итоги'];
const mobileTabs = ['Главная', 'Привычки', 'Цели', 'Город'];
const mobileMore = ['Сферы жизни', 'Финансы', 'Дерево навыков', 'Достижения', 'Магазин', 'Профиль', 'Ключевые итоги', 'Мои задачи'];

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

  const devices = process.env.SMOKE_PLAN_ONLY === '1' ? [true] : [false, true];
  for (const mobile of devices) {
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
    const cityChunkRequests = [];
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (/\/components\/LifeCity\.tsx$|\/assets\/LifeCity-[^/]+\.js$/.test(path)) cityChunkRequests.push(path);
    });
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
      await page.evaluate(() => window.scrollTo(0, 0));
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
    assert.equal(cityChunkRequests.length, 0, 'страница города не загружается при первом открытии приложения');

    const sections = process.env.SMOKE_PLAN_ONLY === '1'
      ? ['Мои задачи']
      : mobile ? [...mobileTabs, ...mobileMore] : desktopMenu;
    for (const label of sections) {
      await open(label);
      if (label === 'Город') assert.ok(cityChunkRequests.length > 0, 'городской чанк загружается при переходе в «Город»');
      if (mobile && label === 'Главная') {
        const footerImage = page.locator('.mobile-footer-map img');
        assert.equal(await footerImage.count(), 1, 'на мобильной главной отображается мини-карта в футере');
        assert.match(await footerImage.getAttribute('src') ?? '', /mobile-footer-islands/, 'мини-карта показывает актуальный остров с психологией');
      }

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
        for (const tab of ['Список', 'Календарь', 'Входящие', 'План жизни']) await click(page.locator('main'), new RegExp('^' + tab));
        const plan = page.locator('.life-planner');
        await plan.waitFor();
        assert.equal(await plan.locator('.lpm-card').count(), 4, 'карта, этапы и сводка сфер отображаются');
        assert.ok(await plan.locator('.lpm-grid-scroll .lpm-cells').count() >= 10, 'шкала нагрузки и строки сфер отображаются');
        if (process.env.SMOKE_PLAN_ONLY === '1') {
          assert.ok(await plan.locator('.plan-goal-row').count() > 0, 'цели видны и переносятся на узком экране');
          assert.ok(await plan.locator('.planned-task').count() > 0, 'запланированные задачи отображаются');
        }
        if (mobile) {
          const layout = await page.evaluate(() => ({
            viewport: innerWidth,
            document: document.documentElement.scrollWidth,
            cards: [...document.querySelectorAll('.life-plan-intro, .lpm-card, .plan-toolbar, .planning-stats, .plan-goals, .planned-days, .unscheduled-tasks')].map((el) => ({
              name: el.className,
              right: Math.round(el.getBoundingClientRect().right),
              scroll: el.scrollWidth,
              client: el.clientWidth,
            })),
            timelines: [...document.querySelectorAll('.lpm-grid-scroll, .lpm-gantt-scroll')].map((el) => ({
              overflow: getComputedStyle(el).overflowX,
              scroll: el.scrollWidth,
              client: el.clientWidth,
            })),
          }));
          assert.ok(layout.document <= layout.viewport + 2, `план не должен расширять страницу: ${JSON.stringify(layout)}`);
          assert.ok(layout.cards.every((card) => card.right <= layout.viewport + 2 && card.scroll <= card.client + 2), `карточки плана помещаются в экран: ${JSON.stringify(layout.cards)}`);
          assert.ok(layout.timelines.length === 2 && layout.timelines.every((row) => row.overflow === 'auto' && row.scroll > row.client), 'шкалы дней и этапов прокручиваются внутри своих блоков');
        }
        await shot('life-plan');
        if (mobile) await page.screenshot({ path: 'work/smoke/mobile-life-plan-full.png', fullPage: true });
        for (const period of ['Квартал', 'Год', 'Месяц']) await click(plan.getByRole('group', { name: 'Период' }), period);
        for (const scope of ['День', 'Неделя', 'Месяц', 'Год', 'Весь путь']) {
          await plan.locator('.plan-scopes').getByRole('button', { name: scope, exact: true }).evaluate((el) => el.click());
          await settle();
        }
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
