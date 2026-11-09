import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const port = 5188;
const url = `http://127.0.0.1:${port}/`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
let browser;
let activePage;
try {
  let ready = false;
  for (const until = Date.now() + 30000; Date.now() < until && server.exitCode === null;) {
    try { if ((await fetch(url)).ok) { ready = true; break; } } catch { /* сервер запускается */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(ready, 'Vite не запустился');
  browser = await chromium.launch({ executablePath: process.env.LIFEGAME_CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  await mkdir('work/planner', { recursive: true });
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, timezoneId: 'Europe/Moscow' });
    await context.route('**/*', (r) => new URL(r.request().url()).origin === new URL(url).origin ? r.continue() : r.abort());
    const page = await context.newPage();
    activePage = page;
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url);
    await page.evaluate(async () => {
      const { newAccountGame } = await import('/src/accountGame.ts');
      const s = newAccountGame('Планировщик');
      s.profile.onboardingComplete = true;
      localStorage.setItem('play-your-life-v1', JSON.stringify(s));
    });
    await page.getByRole('button', { name: 'Продолжить игру на этом устройстве' }).click();
    async function openPlan() {
      if (mobile) { await page.locator('.pyl-tabbar').getByRole('button', { name: 'Ещё', exact: true }).click(); await page.locator('.pyl-more').getByRole('button', { name: /^Мои задачи/ }).click(); }
      else await page.locator('.sidebar').getByRole('button', { name: /^Мои задачи/ }).click();
      await page.getByRole('button', { name: 'Мой план', exact: true }).click();
    }
    await openPlan();
    const plan = page.getByRole('region', { name: 'Мой план', exact: true });
    await plan.getByRole('button', { name: /^Входящие/ }).click();
    await plan.getByLabel('Быстрая задача', { exact: true }).fill('Подготовить план');
    await plan.getByRole('button', { name: 'Добавить задачу', exact: true }).click();
    const task = plan.locator('.pplan-task').filter({ hasText: 'Подготовить план' });
    await task.waitFor();
    await task.getByRole('button', { name: 'Подготовить план', exact: true }).click();
    const win = page.getByRole('dialog', { name: 'Подготовить план' });
    await win.locator('summary').filter({ hasText: 'Планирование и время' }).click();
    await win.getByRole('button', { name: '30 мин', exact: true }).click();
    await win.getByLabel('Добавить фактическое время, мин').fill('20');
    await win.getByRole('button', { name: 'Учесть время', exact: true }).click();
    // План уже установлен в 30 мин (строка выше) — текст включает отклонение от плана (0.76.0, Этап 2).
    await win.getByText('Учтено фактически: 20 мин (план 30 мин, отклонение -10 мин)', { exact: true }).waitFor();
    await win.getByRole('button', { name: 'Готово', exact: true }).click();
    await plan.getByRole('button', { name: 'Настройки плана', exact: true }).click();
    const settings = plan.getByRole('form', { name: 'Настройки плана' });
    await settings.getByLabel('Доступно минут в день').fill('120');
    await settings.getByLabel('Резерв, %').fill('0');
    await settings.getByLabel('Главных задач в день').fill('2');
    await settings.getByLabel('Предупреждать после переносов').fill('1');
    await settings.getByRole('button', { name: 'Сохранить настройки', exact: true }).click();
    const nextWeek = await page.evaluate(async () => {
      const { dateKey } = await import('/src/game.ts');
      const { mondayOf, addDays } = await import('/src/tasksCalendar.ts');
      return addDays(mondayOf(dateKey()), 7);
    });
    await plan.getByLabel('Дата плана', { exact: true }).fill(nextWeek);
    await plan.getByRole('button', { name: 'Спланировать неделю', exact: true }).click();
    const proposal = plan.getByRole('region', { name: 'Предложение плана недели' });
    await proposal.getByText(/Подготовить план →/).waitFor();
    let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('play-your-life-v1')));
    assert.equal(stored.quests[0].dueAt, undefined, 'предложение не должно сохранять даты');
    await proposal.getByRole('button', { name: 'Подтвердить план недели', exact: true }).click();
    await plan.getByRole('button', { name: 'Все задачи', exact: true }).click();
    await task.waitFor();
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('play-your-life-v1')));
    assert.equal(stored.quests[0].dueAt, nextWeek);
    const nextDay = await page.evaluate(async (day) => (await import('/src/tasksCalendar.ts')).addDays(day, 1), nextWeek);
    await task.getByLabel('Плановая дата: Подготовить план', { exact: true }).fill(nextDay);
    await task.getByLabel('Статус: Подготовить план', { exact: true }).selectOption('doing');
    await plan.getByLabel('Вид плана', { exact: true }).selectOption('kanban');
    assert.equal(await plan.locator('.pplan-board > section').filter({ has: page.getByRole('heading', { name: 'В работе · 1', exact: true }) }).count(), 1);
    await plan.getByLabel('Вид плана', { exact: true }).selectOption('matrix');
    await task.getByLabel('Важно', { exact: true }).check();
    await plan.getByLabel('Вид плана', { exact: true }).selectOption('list');
    await task.getByLabel('Выбрать: Подготовить план', { exact: true }).check();
    page.once('dialog', (d) => d.accept());
    await plan.getByRole('button', { name: 'Архивировать выбранные', exact: true }).click();
    await task.waitFor({ state: 'detached' });
    await plan.getByRole('button', { name: 'Архив', exact: true }).click();
    await task.getByRole('button', { name: 'Восстановить', exact: true }).click();
    await plan.getByRole('button', { name: 'Все задачи', exact: true }).click();
    await task.waitFor();
    await page.reload();
    await page.getByRole('button', { name: 'Продолжить игру на этом устройстве' }).click();
    await openPlan();
    await plan.getByRole('button', { name: 'Все задачи', exact: true }).click();
    await task.waitFor();
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('play-your-life-v1')));
    assert.equal(stored.planningSettings.dailyMinutes, 120);
    assert.equal(stored.events.filter((e) => e.planningChange?.type === 'reschedule').length, 1);
    assert.equal(stored.events.filter((e) => e.planningChange?.type === 'time').length, 1);
    // Счётчик переносов на карточке и быстрый фильтр «Часто переношу» (0.76.0, разделы 5.1/5.2;
    // 0.77.0 — заменён с чекбокса на кнопку быстрого фильтра, раздел 2.2 ТЗ «Этап 3»).
    await task.getByText('Переносов: 1.', { exact: false }).waitFor();
    await plan.getByRole('button', { name: 'Часто переношу', exact: true }).click();
    await task.waitFor();
    assert.equal(await plan.locator('.pplan-task').count(), 1, 'фильтр «Часто переношу» должен оставить задачу с переносами');
    await plan.getByRole('button', { name: 'Часто переношу', exact: true }).click();
    // Возвращаем порог к значению по умолчанию — далее в тесте другая задача не должна
    // получить собственное предупреждение «Переносов» (у неё 0 переносов, порог 1 бы не мешал,
    // но следующая проверка .pplan-warning предполагает исходный порог по умолчанию).
    await plan.getByRole('button', { name: 'Настройки плана', exact: true }).click();
    await settings.getByLabel('Предупреждать после переносов').fill('3');
    await settings.getByRole('button', { name: 'Сохранить настройки', exact: true }).click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'горизонтальное переполнение');
    assert.deepEqual(errors, []);
    // Предшественник блокирует выполнение; циклы отклоняются; перенос не каскадный.
    await plan.getByLabel('Быстрая задача', { exact: true }).fill('Согласовать план');
    await plan.getByRole('button', { name: 'Добавить задачу', exact: true }).click();
    const prior = plan.locator('.pplan-task').filter({ hasText: 'Согласовать план' });
    await prior.waitFor();
    const ids = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('play-your-life-v1'));
      return { prior: s.quests.find((q) => q.name === 'Согласовать план').id, target: s.quests.find((q) => q.name === 'Подготовить план').id };
    });
    await task.getByRole('button', { name: 'Подготовить план', exact: true }).click();
    await win.locator('summary').filter({ hasText: 'Планирование и время' }).click();
    await win.getByLabel('Добавить предшественника', { exact: true }).selectOption(ids.prior);
    await win.getByRole('button', { name: 'Добавить зависимость', exact: true }).click();
    await win.getByText('Выполнение заблокировано: незавершённых предшественников — 1.', { exact: true }).waitFor();
    await win.getByRole('button', { name: 'Согласовать план', exact: true }).click();
    const priorWin = page.getByRole('dialog', { name: 'Согласовать план', exact: true });
    assert.equal(await priorWin.getByLabel('Название', { exact: true }).inputValue(), 'Согласовать план', 'редактор переинициализируется при переходе к связанной задаче');
    await priorWin.locator('summary').filter({ hasText: 'Планирование и время' }).click();
    await priorWin.getByLabel('Добавить предшественника', { exact: true }).selectOption(ids.target);
    await priorWin.getByRole('button', { name: 'Добавить зависимость', exact: true }).click();
    await page.getByText('Связь создаёт цикл зависимостей.', { exact: true }).waitFor();
    await priorWin.getByRole('button', { name: 'Готово', exact: true }).click();
    await task.getByLabel('Статус: Подготовить план', { exact: true }).selectOption('done');
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('play-your-life-v1')));
    assert.equal(stored.quests.find((q) => q.id === ids.target).done, false);
    await prior.getByLabel('Плановая дата: Согласовать план', { exact: true }).fill(nextWeek);
    const targetDate = stored.quests.find((q) => q.id === ids.target).dueAt;
    await plan.getByLabel('Дата плана', { exact: true }).fill(nextWeek);
    await plan.getByLabel('Вид плана', { exact: true }).selectOption('timeline');
    const timeline = plan.getByRole('region', { name: 'Шкала сроков', exact: true });
    await timeline.getByRole('button', { name: 'Сроки: Согласовать план', exact: true }).waitFor();
    await timeline.getByRole('button', { name: 'На день позже: Согласовать план', exact: true }).click();
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('play-your-life-v1')));
    assert.equal(stored.quests.find((q) => q.id === ids.target).dueAt, targetDate, 'перенос предшественника не меняет сроки зависимой задачи');
    await timeline.getByRole('button', { name: 'Сроки: Согласовать план', exact: true }).dragTo(timeline.locator('.ptimeline-day').nth(2));
    const shifted = await page.evaluate(() => JSON.parse(localStorage.getItem('play-your-life-v1')));
    assert.equal(shifted.quests.find((q) => q.id === ids.prior).dueAt, await page.evaluate(async (day) => (await import('/src/tasksCalendar.ts')).addDays(day, 2), nextWeek));
    await plan.getByLabel('Вид плана', { exact: true }).selectOption('list');
    await prior.getByLabel('Статус: Согласовать план', { exact: true }).selectOption('done');
    assert.equal(await task.locator('.pplan-warning').count(), 0);
    await plan.getByRole('button', { name: 'Завершить день', exact: true }).click();
    await plan.getByRole('region', { name: 'Вечерний обзор' }).getByText(/^Сегодня: 1 выполнено/).waitFor();
    await plan.getByRole('button', { name: 'Закрыть обзор', exact: true }).click();
    await page.reload();
    await page.getByRole('button', { name: 'Продолжить игру на этом устройстве' }).click();
    await openPlan();
    await plan.getByRole('button', { name: 'Все задачи', exact: true }).click();
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('play-your-life-v1')));
    assert.deepEqual(stored.quests.find((q) => q.id === ids.target).planning.dependencyIds, [ids.prior]);
    await plan.getByLabel('Вид плана', { exact: true }).selectOption('timeline');
    for (const theme of ['dark', 'light']) {
      if (mobile) {
        await page.locator('.pyl-tabbar').getByRole('button', { name: /^Ещё/ }).click();
        await page.getByRole('button', { name: theme === 'dark' ? 'Тёмная тема' : 'Светлая тема', exact: true }).click();
        await page.locator('.pyl-more-backdrop').click({ position: { x: 20, y: 20 } });
      } else await page.locator('.sidebar .pyl-theme').getByRole('button', { name: theme === 'dark' ? 'Тёмная' : 'Светлая', exact: true }).click();
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: `work/planner/${mobile ? 'mobile' : 'desktop'}-${theme}.png`, fullPage: true });
    }
    await context.close();
  }
  console.log('planner-ui: desktop/mobile ok');
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: 'work/planner/failure.png', fullPage: true }).catch(() => {});
    await writeFile('work/planner/failure.txt', await activePage.locator('body').innerText()).catch(() => {});
  }
  throw error;
} finally { await browser?.close(); server.kill(); }
