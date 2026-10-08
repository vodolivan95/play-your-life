import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
await mkdir('work/goal-redesign', { recursive: true });
const server = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    '--host',
    '127.0.0.1',
    '--port',
    '5176',
    '--strictPort',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] },
);
let browser;
try {
  let output = '';
  server.stdout.on('data', (d) => {
    output += String(d);
  });
  server.stderr.on('data', (d) => {
    output += String(d);
  });
  let ready = false;
  for (let i = 0; i < 100 && server.exitCode === null; i++) {
    try {
      ready = (
        await fetch('http://127.0.0.1:5176/', {
          signal: AbortSignal.timeout(1000),
        })
      ).ok;
    } catch {
      /* Starting. */
    }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, output);
  browser = await chromium.launch({
    executablePath: process.env.LIFEGAME_CHROMIUM_PATH || undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  for (const width of [1440, 768, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width < 600 ? 844 : 1100 },
      isMobile: width < 600,
      hasTouch: width < 600,
      timezoneId: 'Europe/Moscow',
    });
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:5176/');
    const ids = await page.evaluate(async () => {
      const { newAccountGame } = await import('/src/accountGame.ts');
      const { saveGoal, saveStage, saveTask } = await import(
        '/src/planning.ts'
      );
      let s = newAccountGame('Тестовый игрок');
      s.profile.onboardingComplete = true;
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, 1000, 400);
      grad.addColorStop(0, '#137bcc');
      grad.addColorStop(1, '#e19a63');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1000, 400);
      s = saveGoal(s, {
        name: 'Достичь уровня B2',
        sphere: 'english',
        target: 100,
        reward: 200,
        description: 'Реальное описание тестовой цели',
        image: canvas.toDataURL('image/jpeg'),
        progressMode: 'tasks',
      });
      const id = s.goals.at(-1).id;
      s = saveStage(s, id, {
        name: 'База A1–A2',
        description: 'Изучить основы',
        status: 'active',
        completionMode: 'tasks',
      });
      s = saveStage(s, id, {
        name: 'Разговорная практика',
        description: 'Говорить увереннее',
        status: 'planned',
        completionMode: 'manual',
        startsAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        dueAt: new Date(Date.now() + 86400000 * 30).toISOString(),
        notes: 'Мои заметки',
      });
      s = saveStage(s, id, {
        name: 'Подготовка к B2',
        status: 'locked',
        completionMode: 'tasks',
      });
      const [a, b, c] = s.goals.at(-1).stages.map((x) => x.id);
      s = saveTask(s, {
        name: 'Выучить слова',
        sphere: 'english',
        difficulty: 'Micro',
        goalId: id,
        stageId: a,
        notes: 'Список новых слов',
        targetValue: 2,
        currentValue: 0,
        unit: 'слова',
      });
      s = saveTask(s, {
        name: 'Посмотреть фильм',
        sphere: 'english',
        difficulty: 'Simple',
        goalId: id,
        stageId: b,
        dueAt: new Date(Date.now() + 86400000).toISOString(),
      });
      s = saveGoal(s, {
        name: 'Сохранённые 68 процентов',
        sphere: 'sport',
        target: 100,
        reward: 100,
        progressMode: 'manual',
      });
      s.goals.at(-1).current = 68;
      localStorage.setItem('play-your-life-v1', JSON.stringify(s));
      return { id, a, b, c, manual: s.goals.at(-1).id };
    });
    await page
      .getByRole('button', { name: 'Продолжить игру на этом устройстве' })
      .click();
    await page.evaluate((id) => {
      location.hash = `/goals/${id}`;
    }, ids.id);
    const workspace = page.locator('.gw-workspace');
    await workspace.waitFor();
    const tabs = workspace.locator('.gw-tabs');
    await workspace
      .getByRole('button', { name: 'Изменить обложку цели' })
      .click();
    const coverEditor = page
      .locator('dialog[open]')
      .filter({
        has: page.getByRole('heading', { name: 'Настроить цель', exact: true }),
      });
    const photo = await page.evaluate(
      (id) =>
        JSON.parse(localStorage.getItem('play-your-life-v1'))
          .goals.find((g) => g.id === id)
          .image.split(',')[1],
      ids.id,
    );
    await coverEditor
      .getByLabel('Изображение проекта')
      .setInputFiles({
        name: 'cover.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from(photo, 'base64'),
      });
    await coverEditor
      .getByRole('button', { name: 'Заменить картинку' })
      .waitFor();
    await coverEditor.getByRole('button', { name: 'Сохранить цель' }).click();
    assert.ok(
      await workspace.locator('.gw-banner-image').evaluate(async (img) => {
        await img.decode();
        return img.naturalWidth / img.naturalHeight === 2.5;
      }),
    );
    const coverState = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('play-your-life-v1')),
    );
    assert.equal(
      coverState.goals.find((g) => g.id === ids.id).startsAt,
      undefined,
    );
    assert.equal(
      coverState.goals.find((g) => g.id === ids.id).dueAt,
      undefined,
    );

    assert.equal(await tabs.getByRole('button').count(), 6);
    assert.equal(await workspace.locator('.gw-roadmap-stage').count(), 3);
    assert.equal(await workspace.locator('.gw-stage-tasks').count(), 1);
    assert.ok(
      await workspace.getByText('LVL 0 / 100', { exact: true }).count(),
    );
    const stageA = workspace.locator(`[data-stage="${ids.a}"]`),
      stageB = workspace.locator(`[data-stage="${ids.b}"]`);
    await stageA
      .getByRole('button', { name: 'Свернуть этап: База A1–A2' })
      .click();
    assert.equal(await stageA.locator('.gw-stage-tasks').count(), 0);
    await stageA
      .getByRole('button', { name: 'Раскрыть этап: База A1–A2' })
      .click();
    await stageB
      .getByRole('button', { name: 'Раскрыть этап: Разговорная практика' })
      .click();
    assert.equal(
      await stageA
        .getByRole('link', { name: 'Продолжить →' })
        .getAttribute('href'),
      `#/goals/${ids.id}/stages/${ids.a}`,
    );
    assert.equal(
      await stageB
        .getByRole('link', { name: 'Продолжить →' })
        .getAttribute('href'),
      `#/goals/${ids.id}/stages/${ids.b}`,
    );
    await workspace.getByRole('button', { name: 'Свернуть все этапы' }).click();
    assert.equal(await workspace.locator('.gw-stage-tasks').count(), 0);
    await stageA
      .getByRole('button', { name: 'Раскрыть этап: База A1–A2' })
      .click();
    await workspace.screenshot({
      path: `work/goal-redesign/goals-${width}.png`,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      'Страница цели шире экрана',
    );
    await stageA.getByRole('link', { name: 'Продолжить →' }).click();
    await page.waitForURL(`**/#/goals/${ids.id}/stages/${ids.a}`);
    assert.equal(await tabs.getByRole('button').count(), 5);
    await workspace.getByRole('button', { name: /^Выучить слова/ }).click();
    const partialDialog = workspace.locator('dialog[open]');
    await partialDialog.getByLabel('Прогресс задачи (слова)').fill('1');
    await partialDialog
      .getByRole('button', { name: 'Сохранить прогресс' })
      .click();
    await workspace
      .getByRole('img', { name: 'Общий прогресс цели: 25%' })
      .waitFor();
    await workspace.getByRole('img', { name: 'Прогресс этапа: 50%' }).waitFor();
    await workspace
      .getByRole('button', { name: 'Выполнить: Выучить слова', exact: true })
      .click();
    await workspace
      .getByRole('img', { name: 'Общий прогресс цели: 50%' })
      .waitFor();
    await workspace
      .getByRole('img', { name: 'Прогресс этапа: 100%' })
      .waitFor();
    await page.reload();
    await page
      .getByRole('button', { name: 'Продолжить игру на этом устройстве' })
      .click();
    await workspace.waitFor();
    assert.ok(
      await workspace
        .getByRole('button', { name: 'Выполнить: Выучить слова', exact: true })
        .isDisabled(),
    );
    await workspace.getByRole('link', { name: 'Перейти к цели →' }).click();
    await workspace
      .locator('.gw-banner')
      .getByRole('img', { name: 'Общий прогресс цели: 50%' })
      .waitFor();
    await tabs.getByRole('button', { name: 'Этапы', exact: true }).click();
    await workspace
      .getByRole('link', { name: 'Этап 2. Разговорная практика', exact: true })
      .click();
    await page.waitForURL(`**/#/goals/${ids.id}/stages/${ids.b}`);
    await workspace
      .getByRole('heading', {
        name: 'Этап 2. Разговорная практика',
        exact: true,
      })
      .waitFor();
    const month = await workspace.locator('.gw-calendar-heading b').innerText();
    await workspace.getByRole('button', { name: 'Следующий месяц' }).click();
    assert.notEqual(
      await workspace.locator('.gw-calendar-heading b').innerText(),
      month,
    );
    await workspace.getByRole('button', { name: 'Предыдущий месяц' }).click();
    await workspace
      .getByRole('button', { name: 'Редактировать заметки →' })
      .click();
    let d = workspace.locator('dialog[open]');
    await d.getByLabel('Текст').fill('Сохранённые заметки');
    await d.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await page.reload();
    await page
      .getByRole('button', { name: 'Продолжить игру на этом устройстве' })
      .click();
    await workspace.getByText('Сохранённые заметки', { exact: true }).waitFor();
    await workspace.screenshot({
      path: `work/goal-redesign/stage-${width}.png`,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      'Страница этапа шире экрана',
    );
    for (const name of [
      'Задачи',
      'Временная шкала',
      'Настройки',
      'Статистика',
      'Обзор',
    ])
      await tabs.getByRole('button', { name, exact: true }).click();
    await workspace
      .getByRole('button', { name: 'Выполнить: Посмотреть фильм', exact: true })
      .click();
    await workspace
      .getByRole('img', { name: 'Общий прогресс цели: 100%' })
      .waitFor();
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('play-your-life-v1')),
    );
    assert.equal(saved.goals.find((g) => g.id === ids.id).rewarded, true);
    assert.equal(
      saved.events.filter((e) => e.kind === 'goal' && e.goalId === ids.id)
        .length,
      1,
    );
    await workspace.getByRole('link', { name: 'Перейти к цели →' }).click();
    await workspace.locator('.gw-motivation').click();
    d = workspace.locator('dialog[open]');
    await d.getByLabel('Текст').fill('Моя настоящая мотивация');
    await d.getByRole('button', { name: 'Сохранить', exact: true }).click();
    for (const name of ['Задачи', 'Статистика', 'Награды', 'История', 'Обзор'])
      await tabs.getByRole('button', { name, exact: true }).click();
    await workspace
      .getByRole('button', { name: '+ Этап', exact: true })
      .click();
    const editor = page.locator('dialog[open]').filter({
      has: page.getByRole('heading', { name: 'Новый этап', exact: true }),
    });
    await editor
      .getByLabel('Название этапа', { exact: true })
      .fill('Созданный этап');
    await editor
      .getByLabel('Описание этапа', { exact: true })
      .fill('Новые реальные шаги');
    await editor.getByRole('button', { name: 'Сохранить этап' }).click();
    await workspace
      .getByRole('link', { name: 'Этап 4. Созданный этап', exact: true })
      .click();
    await workspace
      .getByRole('button', { name: 'Редактировать этап', exact: true })
      .click();
    const stageEditor = page.locator('dialog[open]').filter({
      has: page.getByRole('heading', { name: 'Изменить этап', exact: true }),
    });
    await stageEditor
      .getByLabel('Название этапа', { exact: true })
      .fill('Изменённый этап');
    await stageEditor.getByRole('button', { name: 'Сохранить этап' }).click();
    await workspace
      .getByRole('heading', { name: 'Этап 4. Изменённый этап', exact: true })
      .waitFor();
    await workspace
      .getByRole('button', { name: '＋ Добавить задачу', exact: true })
      .click();
    const taskEditor = page
      .locator('dialog[open]')
      .filter({
        has: page.getByRole('heading', { name: 'Новая задача', exact: true }),
      });
    await taskEditor
      .getByLabel('Название задачи', { exact: true })
      .fill('Созданная задача');
    await taskEditor.getByRole('button', { name: 'Сохранить задачу' }).click();
    await workspace.getByRole('button', { name: /^Созданная задача/ }).click();
    await workspace
      .locator('dialog[open]')
      .getByRole('button', { name: 'Редактировать задачу' })
      .click();
    const editTask = page
      .locator('dialog[open]')
      .filter({
        has: page.getByRole('heading', {
          name: 'Изменить задачу',
          exact: true,
        }),
      });
    await editTask
      .getByLabel('Название задачи', { exact: true })
      .fill('Изменённая задача');
    await editTask.getByRole('button', { name: 'Сохранить задачу' }).click();
    await workspace
      .getByRole('button', { name: /^Изменённая задача/ })
      .waitFor();
    await workspace
      .getByRole('button', {
        name: 'Дублировать этап с задачами',
        exact: false,
      })
      .click();
    page.once('dialog', (dialog) => dialog.accept());
    await workspace
      .getByRole('button', { name: 'Удалить этап', exact: false })
      .click();
    await workspace.locator('.gw-roadmap').waitFor();
    assert.equal(await workspace.locator('.gw-roadmap-stage').count(), 4);
    await page.reload();
    await page
      .getByRole('button', { name: 'Продолжить игру на этом устройстве' })
      .click();
    await workspace
      .locator('.gw-motivation')
      .getByText('Моя настоящая мотивация', { exact: false })
      .waitFor();
    const final = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('play-your-life-v1')),
    );
    assert.equal(
      final.events.filter((e) => e.kind === 'goal' && e.goalId === ids.id)
        .length,
      1,
    );
    await page.evaluate((ids) => {
      location.hash = `/goals/${ids.id}/stages/${ids.c}`;
    }, ids);
    await workspace
      .getByRole('heading', { name: 'Этап заблокирован' })
      .waitFor();
    await page.evaluate((id) => {
      location.hash = `/goals/${id}`;
    }, ids.manual);
    await workspace
      .getByRole('img', { name: 'Общий прогресс цели: 68%' })
      .waitFor();
    assert.equal(errors.length, 0, errors.join('\n'));
    await context.close();
    console.log(
      `Цели и этапы ${width}px: URL, задачи, календарь, вкладки, создание/изменение/копирование/удаление, 68%, награды и перезагрузка — OK`,
    );
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
