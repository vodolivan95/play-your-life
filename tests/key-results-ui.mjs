// «Ключевые итоги»: единый месяц, личные числа, планы и победы без обращения к облаку.
// Снимки: work/key-results/*.png. Сценарий намеренно не создаёт задач из итогов.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

await mkdir('work/key-results', { recursive: true });
const port = 5181;
const url = `http://127.0.0.1:${port}/`;
const server = spawn(process.execPath, [
  'node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort',
], { stdio: ['ignore', 'pipe', 'pipe'] });
let browser;

function monthLabel(month) {
  const [year, number] = month.split('-').map(Number);
  return new Date(year, number - 1, 1, 12).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '');
}
function monthOnly(month) {
  return monthLabel(month).split(' ')[0];
}
async function assertNoDocumentOverflow(page, where) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.ok(
    dimensions.scrollWidth <= dimensions.clientWidth + 1,
    `${where}: документ прокручивается по горизонтали (${dimensions.scrollWidth} > ${dimensions.clientWidth})`,
  );
}
async function openKeyResults(page, mobile) {
  const continueGame = page.getByRole('button', { name: 'Продолжить игру на этом устройстве' });
  // `reload()` завершается до React-гидратации: locator ожидает штатную кнопку,
  // вместо того чтобы преждевременно принять ещё пустой DOM за уже открытую игру.
  await continueGame.click();
  await page.locator('.sidebar').waitFor({ state: 'attached' });
  if (mobile) {
    await page.locator('.pyl-tabbar').getByRole('button', { name: /^Ещё/ }).click();
    await page.locator('.pyl-more').getByRole('button', { name: /Ключевые итоги/ }).click();
  } else {
    await page.locator('.sidebar').getByRole('button', { name: /^Ключевые итоги/ }).click();
  }
  await page.locator('.key-results').waitFor();
}
async function clickTab(page, name, panel) {
  await page.getByRole('tab', { name: new RegExp(`^${name}`) }).click();
  await page.locator(panel).waitFor();
}

try {
  let ready = false;
  for (const deadline = Date.now() + 30_000; Date.now() < deadline && server.exitCode === null;) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1_000) })).ok) {
        ready = true;
        break;
      }
    } catch { /* Vite ещё запускается. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Vite не запустился');
  browser = await chromium.launch({
    executablePath: process.env.LIFEGAME_CHROMIUM_PATH || undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  for (const mobile of [false, true]) {
    for (const theme of ['dark', 'light']) {
      const name = `${mobile ? 'mobile' : 'desktop'}-${theme}`;
      const context = await browser.newContext({
        viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
        isMobile: mobile,
        hasTouch: mobile,
        timezoneId: 'Europe/Moscow',
      });
      // Не допускаем никаких внешних Firebase/TickTick/API-запросов и, следовательно, записей в них.
      await context.route('**/*', (route) => {
        const requestUrl = route.request().url();
        if (requestUrl.startsWith(url) || requestUrl.startsWith('data:') || requestUrl.startsWith('blob:')) return route.continue();
        return route.abort();
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));

      await page.goto(url);
      const seed = await page.evaluate(async (theme) => {
        const { initialState } = await import('/src/game.ts');
        const { monthKey, moveMonth } = await import('/src/monthly.ts');
        const { patchSphereReview, saveReview } = await import('/src/keyResults.ts');
        const now = new Date(); // Текущий месяц всегда реальный, не замороженный в старом fixture.
        const current = monthKey(now);
        const previous = moveMonth(current, -1);
        const previousOther = moveMonth(current, -2);
        const blankPast = moveMonth(current, -3);
        let state = initialState();
        state.profile.onboardingComplete = true;
        const initialQuestIds = state.quests.map((quest) => quest.id);

        // Два плана прошлого месяца должны прийти в начало текущих итогов без создания задач.
        state = saveReview(state, previous, {
          nextPlans: [
            { id: 'plan-sleep', title: 'Первый тестовый план', sphere: 'health' },
            { id: 'plan-work', title: 'Второй тестовый план', sphere: 'tasks' },
          ],
        }, now, 'completed');
        // 7 — осмысленное прошлое число, 0 — иной осмысленный результат, а blankPast остаётся пропуском.
        state = patchSphereReview(state, previous, 'health', { tasksDone: 7 }, now);
        state = patchSphereReview(state, previousOther, 'health', { tasksDone: 0 }, now);
        state = saveReview(state, blankPast, {}, now, 'completed');

        localStorage.setItem('play-your-life-v1', JSON.stringify(state));
        localStorage.setItem('play-your-life-home-theme', theme);
        localStorage.removeItem('pyl-results-hints');
        return { current, previous, previousOther, blankPast, initialQuestIds };
      }, theme);
      await page.reload();
      await openKeyResults(page, mobile);

      // Все пять role-вкладок — единая рабочая область.
      const tabs = page.getByRole('tab');
      assert.equal(await tabs.count(), 5, 'Ровно пять вкладок ключевых итогов');
      for (const label of ['Отчёт месяца', 'Мои итоги', 'Ключевой результат', 'Динамика', 'Итоги года']) {
        assert.equal(await page.getByRole('tab', { name: new RegExp(`^${label}`) }).count(), 1, `Есть вкладка «${label}»`);
      }

      // Переключатель периода относится к контейнеру, а не к отдельной вкладке.
      const monthPicker = page.getByLabel('Выбрать месяц итогов');
      assert.equal(await monthPicker.inputValue(), seed.current);
      await monthPicker.fill(seed.previous);
      await clickTab(page, 'Мои итоги', '.myr');
      assert.equal(await page.getByLabel('Выбрать месяц итогов').inputValue(), seed.previous, 'Месяц сохранён на вкладке «Мои итоги»');
      await clickTab(page, 'Отчёт месяца', '.mrep');
      await page.locator('.mrep').getByRole('heading', { name: monthLabel(seed.previous) }).waitFor();
      assert.equal(await page.getByLabel('Выбрать месяц итогов').inputValue(), seed.previous, 'Месяц сохранён при возврате в отчёт');
      await page.getByLabel('Выбрать месяц итогов').fill(seed.current);
      await assertNoDocumentOverflow(page, `${name}: отчёт выбранного месяца`);

      await clickTab(page, 'Мои итоги', '.myr');
      assert.ok(await page.locator('.myr-hint').count() > 0, 'Подсказки включены по умолчанию');
      const hints = page.getByRole('switch', { name: 'Подсказки' });
      // Видимый ползунок — соседний span, поэтому программный click нужен именно
      // для checkbox; результат по-прежнему наблюдаем только через доступный UI.
      await hints.evaluate((element) => element.click());
      assert.equal(await page.locator('.myr-hint').count(), 0, 'Подсказки скрываются переключателем');

      // Краткий вариант не удаляет форму: полные ручные числа возвращаются без потери месяца.
      await page.getByRole('button', { name: 'Ответить коротко', exact: true }).click();
      assert.equal(await page.locator('.kr-count-grid').isVisible(), false, 'В кратком варианте сетка чисел скрыта');
      await page.getByRole('button', { name: 'Показать полный вариант', exact: true }).click();
      await page.locator('.kr-count-grid').waitFor();

      // Независимые ответы на два перенесённых плана, включая свободный текст.
      const sleepPlan = page.getByRole('group', { name: 'Результат плана: Первый тестовый план' });
      const workPlan = page.getByRole('group', { name: 'Результат плана: Второй тестовый план' });
      await sleepPlan.getByRole('button', { name: 'Да', exact: true }).click();
      assert.equal(await sleepPlan.getByRole('button', { name: 'Да', exact: true }).getAttribute('aria-pressed'), 'true');
      await workPlan.getByRole('button', { name: 'Свой ответ', exact: true }).click();
      const customAnswer = page.getByLabel('Свой ответ: Второй тестовый план');
      await customAnswer.fill('Перенёс в другой формат и продолжу в ноябре');
      assert.equal(await sleepPlan.getByRole('button', { name: 'Да', exact: true }).getAttribute('aria-pressed'), 'true', 'Ответ первого плана не заменён вторым');
      assert.equal(await customAnswer.inputValue(), 'Перенёс в другой формат и продолжу в ноябре');

      // Ручное число, общий вывод и отдельный план — только пользовательские записи, не новые квесты.
      const healthCount = page.getByLabel('Задач закрыто за месяц в сфере Здоровье');
      // Существующая компактная мобильная обложка скрывает aside; сумму проверяем и в его DOM.
      const tasksTotal = page.getByRole('group', { name: 'Итого задач по всем сферам', exact: true, includeHidden: true }).locator('b');
      assert.equal(await tasksTotal.textContent(), '—', 'Без ручных чисел сумма не подменяется нулём');
      await healthCount.fill('0');
      assert.equal(await tasksTotal.textContent(), '0', 'Явно внесённый ноль остаётся нулём');
      await healthCount.fill('4');
      assert.equal(await tasksTotal.textContent(), '4', 'Карточка показывает количество задач, а не число заполненных сфер');
      const sportCount = page.getByLabel('Задач закрыто за месяц в сфере Спорт');
      await sportCount.fill('6');
      assert.equal(await tasksTotal.textContent(), '10', 'Сумма включает ручные числа всех сфер');
      await sportCount.fill('');
      assert.equal(await tasksTotal.textContent(), '4', 'Очистка поля пересчитывает сумму без изменения других сфер');
      await page.getByLabel('Главный вывод месяца').fill('Сон важнее идеального расписания.');
      await page.getByRole('button', { name: /Добавить план/ }).click();
      await page.getByLabel('План 1 на следующий месяц').fill('Ложиться до 23:00 пять дней в неделю');
      await page.getByLabel('Сфера плана 1').selectOption('health');
      await page.screenshot({ path: `work/key-results/${name}-my-results.png`, fullPage: true });
      await page.getByRole('button', { name: 'Итоги подведены', exact: true }).click();
      await page.waitForFunction(({ current }) => {
        const state = JSON.parse(localStorage.getItem('play-your-life-v1') || '{}');
        const review = state.monthlyReflections?.[current]?.review;
        return state.monthlyReflections?.[current]?.status === 'completed' &&
          review?.spheres?.health?.tasksDone === 4 &&
          review?.conclusion === 'Сон важнее идеального расписания.' &&
          review?.planChecks?.['plan-sleep']?.outcome === 'done' &&
          review?.planChecks?.['plan-work']?.comment === 'Перенёс в другой формат и продолжу в ноябре' &&
          review?.nextPlans?.[0]?.title === 'Ложиться до 23:00 пять дней в неделю';
      }, { current: seed.current });
      const storedAfterReview = await page.evaluate(() => JSON.parse(localStorage.getItem('play-your-life-v1') || '{}'));
      assert.deepEqual(storedAfterReview.quests.map((quest) => quest.id), seed.initialQuestIds, 'Итоги и планы не создают квесты автоматически');
      await assertNoDocumentOverflow(page, `${name}: мои итоги`);

      // Личная победа и её необязательное подтверждение живут с тем же ручным числом.
      await clickTab(page, 'Ключевой результат', '.prv-victories');
      const healthVictory = page.locator('.prv-victory-card').filter({ hasText: 'Здоровье' });
      assert.equal(await healthVictory.count(), 1, 'Есть форма ключевого результата для здоровья');
      await healthVictory.getByLabel('Ключевой результат').fill('Наладил сон и восстановление');
      await healthVictory.locator('summary').click();
      await healthVictory.getByLabel('Подтверждение результата в сфере «Здоровье»').fill('Пять вечеров лёг спать до 23:00.');
      await healthVictory.getByText('Ручная отметка: 4 задачи за месяц.').waitFor();
      await page.screenshot({ path: `work/key-results/${name}-victory.png`, fullPage: true });
      await assertNoDocumentOverflow(page, `${name}: ключевой результат`);

      // Динамика одновременно показывает значение, ноль как значение и неизвестный месяц как пропуск.
      await clickTab(page, 'Динамика', '.prv-dynamics');
      await page.getByRole('group', { name: 'Диапазон динамики' }).getByRole('button', { name: '12 месяцев', exact: true }).click();
      await page.getByRole('group', { name: 'Источник динамики' }).getByRole('button', { name: 'Активность в приложении', exact: true }).click();
      await page.locator('.prv-game-statistics').waitFor();
      await page.getByRole('group', { name: 'Источник динамики' }).getByRole('button', { name: 'Личные результаты', exact: true }).click();
      const chart = page.getByRole('group', { name: 'Динамика ручных чисел по месяцам' });
      await chart.getByRole('button', { name: new RegExp(`${monthLabel(seed.previous)}: 7 задач`) }).waitFor();
      await chart.getByRole('button', { name: new RegExp(`${monthLabel(seed.previousOther)}: 0 задач`) }).waitFor();
      await chart.getByRole('button', { name: new RegExp(`${monthLabel(seed.blankPast)}: число не указано`) }).waitFor();
      await chart.getByRole('button', { name: new RegExp(`${monthLabel(seed.current)}: 4 задачи`) }).click();
      await page.locator('.prv-timeline-detail').getByText('Наладил сон и восстановление', { exact: true }).waitFor();
      await page.screenshot({ path: `work/key-results/${name}-dynamics.png`, fullPage: true });
      await assertNoDocumentOverflow(page, `${name}: динамика`);

      // Победа должна быть видна и в отчёте месяца, который использует тот же выбранный период.
      await clickTab(page, 'Отчёт месяца', '.mrep');
      assert.equal(await page.getByLabel('Выбрать месяц итогов').inputValue(), seed.current, 'Возврат в отчёт не сбрасывает общий месяц');
      await page.locator('.mrep').getByText('Наладил сон и восстановление', { exact: true }).waitFor();
      await page.screenshot({ path: `work/key-results/${name}-report.png`, fullPage: true });
      await assertNoDocumentOverflow(page, `${name}: отчёт с победой`);

      // В годе нет общего picker-а; завершённые месяцы суммируются, текущий отдельно, будущее нейтрально.
      await clickTab(page, 'Итоги года', '.prv-year');
      assert.equal(await page.getByLabel('Выбрать месяц итогов').count(), 0, 'В годовых итогах общий выбор месяца не показывается');
      const yearTable = page.locator('.prv-year-table');
      const healthColumn = await yearTable.locator('thead th').evaluateAll((cells) =>
        cells.findIndex((cell) => cell.textContent?.includes('Здоровье')) - 1,
      );
      assert.ok(healthColumn >= 0, 'В годовой матрице есть колонка здоровья');
      const yearCell = (month) => yearTable.locator('tbody tr').filter({ hasText: monthOnly(month) }).locator('td').nth(healthColumn);
      assert.match((await yearCell(seed.previous).innerText()).trim(), /^7$/, 'Прошлый месяц даёт 7 в годовой матрице');
      assert.match((await yearCell(seed.previousOther).innerText()).trim(), /^0$/, 'Ноль остаётся указанным числом');
      assert.match((await yearCell(seed.blankPast).innerText()).trim(), /^—$/, 'Пропуск не превращается в ноль');
      const completedTotals = yearTable.locator('tfoot tr').filter({ hasText: 'Завершённые' }).locator('td').nth(healthColumn);
      assert.match((await completedTotals.innerText()).replace(/\s/g, ''), /^7задач$/, 'В сумму входят 7 и 0 завершённых месяцев, но не текущий');
      const currentTotals = yearTable.locator('tfoot tr').filter({ hasText: 'Текущий месяц' }).locator('td').nth(healthColumn);
      assert.match((await currentTotals.innerText()).replace(/\s/g, ''), /^4идётсейчас$/, 'Текущее ручное число выводится отдельно');
      const futureCells = yearTable.locator('tbody td.is-future');
      assert.ok(await futureCells.count() > 0, 'В текущем году есть нейтральные будущие ячейки');
      for (const text of await futureCells.allTextContents()) assert.match(text.trim(), /^ещё не наступил$/, 'Будущий месяц не считается нулём');
      await page.locator('.prv-year-month.is-current').getByText('Наладил сон и восстановление', { exact: true }).waitFor();
      const yearRoot = page.locator('.prv-year-root');
      const yearReveal = yearRoot.locator('[data-year-reveal]').first();
      await yearReveal.scrollIntoViewIfNeeded();
      await page.waitForFunction((element) => element.getAttribute('data-year-reveal') === 'visible', await yearReveal.elementHandle());
      await page.waitForFunction((element) => {
        const style = getComputedStyle(element);
        return style.opacity !== '0' && element.getAnimations().every((animation) => animation.playState === 'finished');
      }, await yearReveal.elementHandle());
      const yearMonths = yearRoot.locator('.prv-year-month');
      await yearMonths.first().scrollIntoViewIfNeeded();
      await page.waitForFunction((element) => element.getAttribute('data-year-reveal') === 'visible', await yearMonths.first().elementHandle());
      const spherePicker = page.getByRole('group', { name: 'Сфера для годовой хроники' });
      await spherePicker.getByRole('button', { name: 'Спорт' }).click();
      await assert.equal(await yearMonths.count(), 12, 'При смене сферы сохраняются все 12 месяцев');
      await spherePicker.getByRole('button', { name: 'Здоровье' }).click();
      assert.equal(await yearMonths.count(), 12, 'При возврате к здоровью сохраняются все 12 месяцев');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction((root) => {
        const months = [...root.querySelectorAll('.prv-year-month')];
        return months.length === 12 && months.every((month) => month.getAttribute('data-year-reveal') === 'visible' &&
          getComputedStyle(month).animationName === 'none' && getComputedStyle(month).transform === 'none');
      }, await yearRoot.elementHandle());
      await page.screenshot({ path: `work/key-results/${name}-year.png`, fullPage: true });
      await assertNoDocumentOverflow(page, `${name}: итоги года`);

      // Сохранённый вручную результат не теряется ни после смены вкладок, ни после перезагрузки.
      await page.reload();
      await openKeyResults(page, mobile);
      await clickTab(page, 'Мои итоги', '.myr');
      assert.equal(await page.getByLabel('Выбрать месяц итогов').inputValue(), seed.current);
      assert.equal(await page.getByLabel('Задач закрыто за месяц в сфере Здоровье').inputValue(), '4');
      assert.equal(await page.getByLabel('Главный вывод месяца').inputValue(), 'Сон важнее идеального расписания.');
      assert.equal(await page.locator('.myr-hint').count(), 0, 'Настройка подсказок переживает перезагрузку');
      assert.equal(await page.getByRole('group', { name: 'Результат плана: Первый тестовый план' }).getByRole('button', { name: 'Да', exact: true }).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.getByLabel('Свой ответ: Второй тестовый план').inputValue(), 'Перенёс в другой формат и продолжу в ноябре');
      await assertNoDocumentOverflow(page, `${name}: мои итоги после перезагрузки`);
      assert.deepEqual(errors, [], `${name}: ошибки страницы: ${errors.join('; ')}`);
      await context.close();
    }
  }
} finally {
  await browser?.close();
  server.kill();
}
