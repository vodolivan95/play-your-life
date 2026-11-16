import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5189', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { ready = (await fetch('http://127.0.0.1:5189/', { signal: AbortSignal.timeout(1000) })).ok; } catch { /* starting */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Vite не запустился');
  browser = await chromium.launch({ executablePath: process.env.LIFEGAME_CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 600, hasTouch: width < 600, timezoneId: 'Europe/Moscow', reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:5189/');
    const ids = await page.evaluate(async () => {
      const { newAccountGame } = await import('/src/accountGame.ts');
      const { saveGoal, saveStage, saveTask } = await import('/src/planning.ts');
      let s = newAccountGame('Тестовый игрок');
      s.profile.onboardingComplete = true;
      s = saveGoal(s, { name: 'Проект со следующим этапом', sphere: 'english', target: 100, reward: 200, progressMode: 'tasks' });
      const goalId = s.goals.at(-1).id;
      s = saveStage(s, goalId, { name: 'Текущий этап без задач', status: 'active', completionMode: 'tasks' });
      s = saveStage(s, goalId, { name: 'Будущий этап', status: 'locked', completionMode: 'tasks' });
      const stageId = s.goals.at(-1).stages.at(-1).id;
      s = saveTask(s, { name: 'Будущий шаг 1', sphere: 'english', difficulty: 'Micro', goalId, stageId });
      s = saveTask(s, { name: 'Будущий шаг 2', sphere: 'english', difficulty: 'Micro', goalId, stageId });
      localStorage.setItem('play-your-life-v1', JSON.stringify(s));
      return { goalId, stageId };
    });
    await page.getByRole('button', { name: 'Продолжить игру на этом устройстве' }).click();
    await page.evaluate(id => { location.hash = `/goals/${id}`; }, ids.goalId);
    const workspace = page.locator('.gw-project');
    await workspace.waitFor();
    const future = workspace.locator(`[data-stage="${ids.stageId}"]`);
    await future.getByRole('button', { name: 'Раскрыть этап: Будущий этап' }).click();
    const rows = future.locator('.task-reorder-item[data-task-order-id]');
    assert.equal(await rows.count(), 2);
    const grip = rows.first().locator('.task-reorder-grip');
    assert.equal((await grip.textContent()).trim(), '⋮');
    assert.ok(await rows.first().locator('.gw-task-check').isDisabled());
    const rowBox = await rows.first().boundingBox(), gripBox = await grip.boundingBox(), checkBox = await rows.first().locator('.gw-task-check').boundingBox();
    assert.ok(gripBox.x >= rowBox.x && gripBox.x + gripBox.width <= rowBox.x + rowBox.width);
    assert.ok(checkBox.x > gripBox.x + gripBox.width && checkBox.x - gripBox.x - gripBox.width < 36);
    await grip.press('End');
    assert.deepEqual(await rows.locator('.gw-task-name strong').allTextContents(), ['Будущий шаг 2', 'Будущий шаг 1']);
    await page.waitForFunction(({ stageId }) => JSON.parse(localStorage.getItem('play-your-life-v1')).quests.filter(q => q.stageId === stageId).map(q => q.name).join('|') === 'Будущий шаг 2|Будущий шаг 1', { stageId: ids.stageId });
    await context.close();
    console.log(`Проект: ручки и перенос в заблокированном этапе ${width}px — OK`);
  }
} finally { await browser?.close(); server.kill('SIGTERM'); }
