import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';

// Локальная фикстура: повторное открытие фокуса и неизменность истории обзора.
const dir = 'work/weekly-review';
const origin = 'http://127.0.0.1:5193';
await mkdir(dir, { recursive: true });
await writeFile(`${dir}/fixture.html`, '<!doctype html><meta charset="utf-8"><div id="root"></div><script type="module" src="/work/weekly-review/fixture.tsx"></script>');
await writeFile(`${dir}/fixture.tsx`, `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import WeeklyReviewWizard from '../../src/components/WeeklyReviewWizard';
import { initialState } from '../../src/game';
import { weekAnchor, confirmWeeklyReview } from '../../src/weeklyReview';
import { addDays } from '../../src/tasksCalendar';
function Fixture() {
  const [state, setState] = useState(() => {
    const week = weekAnchor();
    let s = initialState();
    s.goals = [{ id: 'review-goal', name: 'Сохранённый проект', sphere: 'health', current: 0, target: 100, created: '2020-01-01', reward: 0, rewarded: false, progressMode: 'manual' }];
    s.quests = [{ id: 'review-task', name: 'Задача обзора', sphere: 'health', xp: 20, difficulty: 'Medium', done: false, goalId: 'review-goal', dueAt: week }];
    s = confirmWeeklyReview(s, addDays(week, -7), ['review-goal'], { focusNote: 'Прошлая неделя' });
    return confirmWeeklyReview(s, week, ['review-goal'], { focusNote: 'Сохранённый фокус', problemTaskIds: ['review-task'] });
  });
  const [open, setOpen] = useState(true);
  localStorage.setItem('weekly-review-fixture', JSON.stringify(state));
  return <>
    <button onClick={() => setOpen(true)}>Открыть обзор</button>
    <button onClick={() => setState(s => ({ ...s, goals: s.goals.map(g => ({ ...g, name: 'Изменённый проект', paused: true })), quests: s.quests.map(q => ({ ...q, done: true, completedAt: new Date().toISOString() })) }))}>Изменить данные после обзора</button>
    {open && <WeeklyReviewWizard state={state} onClose={() => setOpen(false)} onOpenTask={() => {}} onApply={action => setState(action)} />}
  </>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
`);
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5193', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
server.stdout.on('data', (data) => { output += data; });
server.stderr.on('data', (data) => { output += data; });
let browser;
try {
  let ready = false;
  for (const until = Date.now() + 40000; Date.now() < until && server.exitCode === null;) {
    try { if ((await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch { /* сервер запускается */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(ready, `Vite не запустился: ${output}`);
  browser = await chromium.launch({ executablePath: process.env.LIFEGAME_CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, timezoneId: 'Europe/Moscow' });
    await context.route('**/*', (r) => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${origin}/${dir}/fixture.html`);
    const dialog = page.getByRole('dialog', { name: 'Недельный обзор', exact: true });
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('weekly-review-fixture')));
    const step = (name) => dialog.getByRole('button', { name, exact: true }).click();
    await dialog.waitFor();
    const weeks = Object.keys((await stored()).weeklyReviews).sort();
    await step('4. Фокус недели');
    assert.equal(await dialog.locator('input[type=checkbox]').isChecked(), true);
    assert.equal(await dialog.getByRole('textbox').inputValue(), 'Сохранённый фокус');
    await step('5. Подтверждение');
    await step('Обновить обзор');
    await dialog.waitFor({ state: 'hidden' });
    assert.deepEqual((await stored()).weeklyReviews[weeks[1]].focusGoalIds, ['review-goal']);
    assert.equal((await stored()).weeklyReviews[weeks[1]].focusNote, 'Сохранённый фокус');
    await page.getByRole('button', { name: 'Открыть обзор', exact: true }).click();
    await dialog.getByLabel('Неделя обзора').fill(weeks[0]);
    await step('4. Фокус недели');
    assert.equal(await dialog.getByRole('textbox').inputValue(), 'Прошлая неделя');
    await step('Закрыть');
    await page.getByRole('button', { name: 'Изменить данные после обзора', exact: true }).click();
    const savedBeforeHistory = (await stored()).weeklyReviews;
    await page.getByRole('button', { name: 'Открыть обзор', exact: true }).click();
    await step('5. Подтверждение');
    await step('Открыть предыдущие обзоры');
    await dialog.locator('.wrw-list button').first().click();
    assert.equal(await dialog.locator('.wrw-grid span').nth(1).locator('b').innerText(), '1', 'история сохраняет число невыполненных задач');
    await step('3. Продвижение проектов');
    await dialog.getByText('Сохранённый проект', { exact: true }).waitFor();
    assert.equal(await dialog.getByText('Изменённый проект', { exact: true }).count(), 0);
    await step('4. Фокус недели');
    assert.equal(await dialog.getByRole('textbox').inputValue(), 'Сохранённый фокус');
    assert.equal(await dialog.getByRole('textbox').getAttribute('readonly'), '');
    await step('5. Подтверждение');
    assert.equal(await dialog.getByRole('button', { name: 'Обновить обзор', exact: true }).count(), 0);
    assert.deepEqual((await stored()).weeklyReviews, savedBeforeHistory, 'просмотр не изменяет обзор');
    await step('Перейти к обновлению обзора');
    await step('1. Итоги недели');
    assert.equal(await dialog.locator('.wrw-grid span').nth(1).locator('b').innerText(), '0', 'явное обновление пересчитывает данные');
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `${dir}/${mobile ? 'mobile' : 'desktop'}.png`, fullPage: true });
    await context.close();
  }
  console.log('Недельный обзор: фокус сохраняется, история показывает снимок — ПК и телефон');
} finally {
  await browser?.close();
  server.kill();
  await Promise.all(['fixture.html', 'fixture.tsx'].map((name) => rm(`${dir}/${name}`, { force: true })));
}
