import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

// Календарь на странице «Мои задачи»: виды, разворот дня по числу и прокрутка колесом.
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5177", "--strictPort"],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let browser;
try {
  const deadline = Date.now() + 30000;
  let ready = false;
  while (Date.now() < deadline && server.exitCode === null) {
    try {
      const response = await fetch("http://127.0.0.1:5177/", { signal: AbortSignal.timeout(1000) });
      if (response.ok) { ready = true; break; }
    } catch { /* Vite запускается. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, "Vite не запустился");
  browser = await chromium.launch({
    executablePath: process.env.LIFEGAME_CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 }, timezoneId: "Europe/Moscow" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5177/");
  await page.evaluate(async () => {
    const { newAccountGame } = await import("/src/accountGame.ts");
    const { dateKey } = await import("/src/game.ts");
    const s = newAccountGame("Игрок");
    s.profile.onboardingComplete = true;
    const day = new Date();
    day.setDate(day.getDate() > 20 ? 5 : 25);
    const due = dateKey(day);
    s.quests = Array.from({ length: 7 }, (_, i) => ({
      id: `cal${i}`, name: `Календарная задача ${i + 1}`, sphere: "sport", xp: 20, done: false, difficulty: "Medium", dueAt: due,
    }));
    const today = dateKey(new Date());
    const start = new Date(); start.setHours(17, 0, 0, 0);
    const end = new Date(start); end.setHours(18, 0, 0, 0);
    s.quests.push(
      { id: "cal-today", name: "Задача TickTick на весь день", sphere: "sport", xp: 20, done: false, difficulty: "Medium", dueAt: today },
      { id: "cal-timed", name: "Задача TickTick с временем", sphere: "sport", xp: 20, done: false, difficulty: "Medium", startsAt: start.toISOString(), dueAt: end.toISOString() },
    );
    const rangeStart = new Date(); rangeStart.setDate(2); rangeStart.setMonth(rangeStart.getMonth() + 1); rangeStart.setHours(9, 15, 0, 0);
    const rangeEnd = new Date(rangeStart); rangeEnd.setDate(rangeStart.getDate() + 2); rangeEnd.setHours(16, 45, 0, 0);
    s.quests.push({ id: "cal-range", name: "Многодневная задача", sphere: "sport", xp: 20, done: false, difficulty: "Medium", startsAt: rangeStart.toISOString(), dueAt: rangeEnd.toISOString() });
    localStorage.setItem("play-your-life-v1", JSON.stringify(s));
  });
  await page.getByRole("button", { name: "Продолжить игру на этом устройстве" }).click();
  await page.locator(".sidebar").getByRole("button", { name: /^Мои задачи/ }).click();
  // Список: сводка и блок «Задачи по целям и этапам» с фильтром.
  assert.equal(await page.locator(".tsum > div").count(), 6);
  const gtl = page.locator(".gtl");
  await gtl.waitFor();
  assert.equal(await gtl.getByRole("button", { name: "TickTick", exact: true }).count(), 1);
  await gtl.getByRole("button", { name: "Игра", exact: true }).click();
  assert.equal(await gtl.getByRole("button", { name: "Игра", exact: true }).getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "Календарь", exact: true }).click();
  const calendar = page.locator(".tcal");
  await calendar.waitFor();
  assert.equal(await calendar.getByRole("button", { name: "Месяц", exact: true }).getAttribute("aria-pressed"), "true");
  const targetDay = await page.evaluate(() => JSON.parse(localStorage.getItem("play-your-life-v1")).quests.find((q) => q.id === "cal0").dueAt);
  const cell = calendar.locator(`.tcal-cell[data-day="${targetDay}"]`);
  for (const name of ["День", "Неделя", "2 недели", "Месяц"]) {
    await calendar.getByRole("button", { name, exact: true }).click();
    assert.equal(await calendar.getByRole("button", { name, exact: true }).getAttribute("aria-pressed"), "true");
  }
  // Месяц: у дня с семью задачами видны три и «ещё 4»; число разворачивает день, повторное нажатие — сворачивает.
  await cell.first().waitFor();
  assert.equal(await cell.first().locator(".tcal-chip").count(), 3);
  assert.equal((await cell.first().locator(".tcal-more").textContent())?.trim(), "ещё 4");
  await cell.first().locator(".tcal-num").click();
  assert.equal(await cell.first().locator(".tcal-chip").count(), 7);
  const scroll = cell.first().locator(".tcal-list");
  assert.equal(await scroll.evaluate((el) => getComputedStyle(el).overflowY), "auto");
  assert.equal(await cell.first().locator(".tcal-num").getAttribute("aria-pressed"), "true");
  await cell.first().locator(".tcal-num").click();
  assert.equal(await cell.first().locator(".tcal-chip").count(), 3);
  // Одного нажатия на задачу достаточно, чтобы открыть её окно.
  await cell.first().locator(".tcal-chip").first().click();
  // Окно задачи: награда, сложность и срок меняются и сохраняются.
  const win = page.locator(".twin");
  await win.waitFor();
  assert.match(await win.locator(".twin-ring").innerText(), /\+20/);
  assert.equal(await win.getByRole("button", { name: /^Сложная/ }).isDisabled(), true);
  const tomorrow = await page.evaluate(async () => {
    const { dateKey } = await import("/src/game.ts");
    const d = new Date(); d.setDate(d.getDate() + 1); return dateKey(d);
  });
  await win.getByRole("button", { name: "Завтра", exact: true }).click();
  await win.getByLabel("Дата окончания").waitFor();
  assert.equal(await win.getByLabel("Дата окончания").inputValue(), tomorrow);
  assert.equal(await win.getByRole("switch").isDisabled(), false);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("play-your-life-v1")).quests.filter((q) => q.dueAt));
  assert.ok(saved.some((q) => q.dueAt === tomorrow));
  await win.getByRole("button", { name: "Каждый день" }).click();
  await win.getByLabel("Новая подзадача").fill("Первый шаг");
  await win.getByRole("button", { name: "＋ Добавить" }).click();
  await win.getByRole("checkbox").check();
  const rep = await page.evaluate(() => JSON.parse(localStorage.getItem("play-your-life-v1")).quests.filter((q) => q.repeat === "daily"));
  assert.equal(rep.length, 1);
  assert.deepEqual(rep[0].subtasks.map((t) => [t.title, t.done]), [["Первый шаг", true]]);
  await win.getByRole("button", { name: "Сохранить" }).click();
  await win.waitFor({ state: "detached" });
  const rangeDays = await page.evaluate(async () => {
    const { dateKey } = await import("/src/game.ts");
    const q = JSON.parse(localStorage.getItem("play-your-life-v1")).quests.find((item) => item.id === "cal-range");
    const start = new Date(q.startsAt);
    const middle = new Date(start); middle.setDate(middle.getDate() + 1);
    return { start: dateKey(start), middle: dateKey(middle), end: dateKey(new Date(q.dueAt)), startsAt: q.startsAt, dueAt: q.dueAt };
  });
  await calendar.getByRole("button", { name: "Вперёд" }).click();
  const monthRangeChip = (day) => calendar.locator(`.tcal-cell[data-day="${day}"] .tcal-chip`).filter({ hasText: "Многодневная задача" });
  const monthStart = monthRangeChip(rangeDays.start);
  assert.equal(await monthStart.count(), 1);
  assert.match(await monthStart.getAttribute("class"), /is-range-start/);
  assert.match(await monthStart.innerText(), /Начало 09:15/);
  assert.equal(await monthRangeChip(rangeDays.middle).count(), 1);
  assert.match(await monthRangeChip(rangeDays.middle).getAttribute("class"), /is-range-middle/);
  assert.match(await monthRangeChip(rangeDays.middle).innerText(), /Продолжение/);
  assert.equal(await monthRangeChip(rangeDays.end).count(), 1);
  assert.match(await monthRangeChip(rangeDays.end).getAttribute("class"), /is-range-end/);
  assert.match(await monthRangeChip(rangeDays.end).innerText(), /Окончание 16:45/);
  assert.match(await monthStart.getAttribute("title"), /период/);
  await monthStart.click();
  await win.waitFor();
  const unchangedRange = await page.evaluate(() => JSON.parse(localStorage.getItem("play-your-life-v1")).quests.find((item) => item.id === "cal-range"));
  assert.equal(unchangedRange.startsAt, rangeDays.startsAt);
  assert.equal(unchangedRange.dueAt, rangeDays.dueAt);
  await win.getByRole("button", { name: "Готово" }).click();
  await win.waitFor({ state: "detached" });

  await calendar.getByRole("button", { name: "Неделя", exact: true }).click();
  for (const [day, part] of [[rangeDays.start, "start"], [rangeDays.middle, "middle"], [rangeDays.end, "end"]]) {
    const segment = calendar.locator(`.tcal-allday > div[data-day="${day}"] .tcal-chip`).filter({ hasText: "Многодневная задача" });
    assert.equal(await segment.count(), 1, `недельный вид показывает сегмент ${part}`);
    assert.match(await segment.getAttribute("class"), new RegExp(`is-range-${part}`));
  }
  assert.equal(await calendar.locator(".tcal-event").filter({ hasText: "Многодневная задача" }).count(), 0, "междневный период не схлопывается в однодневное timed-событие");

  await calendar.getByRole("button", { name: "День", exact: true }).click();
  await calendar.getByRole("button", { name: "Вперёд" }).click();
  const dayRange = calendar.locator(`.tcal-allday > div[data-day="${rangeDays.start}"] .tcal-chip`).filter({ hasText: "Многодневная задача" });
  assert.equal(await dayRange.count(), 1, "дневной вид показывает часть диапазона, покрывающую выбранный день");
  assert.match(await dayRange.getAttribute("class"), /is-range-start/);

  await calendar.getByRole("button", { name: "2 недели", exact: true }).click();
  for (const day of [rangeDays.start, rangeDays.middle, rangeDays.end]) assert.equal(await monthRangeChip(day).count(), 1);
  await calendar.getByRole("button", { name: "Месяц", exact: true }).click();
  await calendar.getByRole("button", { name: "Сегодня", exact: true }).click();
  // В дневном виде клик также открывает окно и для задачи на весь день, и для события со временем.
  await calendar.getByRole("button", { name: "День", exact: true }).click();
  const allDay = calendar.locator(".tcal-allday .tcal-chip").filter({ hasText: "Задача TickTick на весь день" });
  await allDay.click();
  await win.waitFor();
  await win.getByRole("button", { name: "Сохранить" }).click();
  await win.waitFor({ state: "detached" });
  const timed = calendar.locator(".tcal-event").filter({ hasText: "Задача TickTick с временем" });
  await timed.click();
  await win.waitFor();
  await win.getByRole("button", { name: "Сохранить" }).click();
  await win.waitFor({ state: "detached" });
  await calendar.getByRole("button", { name: "Месяц", exact: true }).click();
  await calendar.getByRole("button", { name: "Сегодня", exact: true }).click();
  await calendar.getByRole("button", { name: "Вперёд" }).click();
  const dragTargetDay = await page.evaluate(async (sourceDay) => {
    const { dateKey } = await import("/src/game.ts");
    const day = new Date(`${sourceDay}T12:00:00`); day.setDate(day.getDate() + 3); return dateKey(day);
  }, rangeDays.middle);
  await monthRangeChip(rangeDays.middle).dragTo(calendar.locator(`.tcal-cell[data-day="${dragTargetDay}"]`));
  const expectedShiftedRange = {
    startsAt: new Date(Date.parse(rangeDays.startsAt) + 3 * 86400000).toISOString(),
    dueAt: new Date(Date.parse(rangeDays.dueAt) + 3 * 86400000).toISOString(),
  };
  await page.waitForFunction((expected) => {
    const q = JSON.parse(localStorage.getItem("play-your-life-v1")).quests.find((item) => item.id === "cal-range");
    return q?.startsAt === expected.startsAt && q?.dueAt === expected.dueAt;
  }, expectedShiftedRange, { timeout: 5000 });
  const movedRange = await page.evaluate(() => JSON.parse(localStorage.getItem("play-your-life-v1")).quests.find((item) => item.id === "cal-range"));
  assert.equal(Date.parse(movedRange.dueAt) - Date.parse(movedRange.startsAt), Date.parse(rangeDays.dueAt) - Date.parse(rangeDays.startsAt));
  // Сразу после полуночи в Москве выполненная задача относится к новому дню,
  // а отказ от задачи не увеличивает календарную нагрузку.
  await page.clock.install({ time: new Date('2026-11-07T00:15:00+03:00') });
  await page.evaluate(async () => {
    const { newAccountGame } = await import('/src/accountGame.ts');
    const s = newAccountGame('Проверка планирования');
    s.profile.onboardingComplete = true;
    const q = { sphere: 'sport', xp: 20, difficulty: 'Medium', done: false };
    s.quests = [
      { ...q, id: 'night-done', name: 'Ночное выполнение', done: true, completedAt: '2026-11-06T21:05:00.000Z' },
      { ...q, id: 'next-week', name: 'Другая неделя', done: true, completedAt: '2026-11-09T12:00:00.000Z' },
      { ...q, id: 'night-plan', name: 'Ночная задача', dueAt: '2026-11-06T21:30:00.000Z' },
      { ...q, id: 'declined', name: 'Отменённая задача', dueAt: '2026-11-07', wontDo: true },
    ];
    localStorage.setItem('play-your-life-v1', JSON.stringify(s));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Продолжить игру на этом устройстве' }).click();
  await page.locator('.sidebar').getByRole('button', { name: /^Мои задачи/ }).click();
  await page.getByRole('button', { name: /^Задачи на сегодня/ }).click();
  const todayList = page.getByRole('region', { name: 'Задачи на сегодня', exact: true });
  await todayList.getByText('Ночная задача', { exact: true }).waitFor();
  assert.equal(await todayList.getByText('Ночное выполнение', { exact: true }).count(), 0, 'выполнение без плановой даты остаётся в итогах, а не в календарном списке');
  assert.equal(await todayList.getByText('Другая неделя', { exact: true }).count(), 0);
  assert.equal(await todayList.getByText('Отменённая задача', { exact: true }).count(), 1);
  assert.match(await page.locator('.tsum > div').filter({ has: page.getByText('Выполнено', { exact: true }) }).innerText(), /Выполнено\s+1\s+за неделю/);
  await page.getByRole('button', { name: 'Список', exact: true }).click();
  const nightRow = page.locator('.gtl-item').filter({ hasText: 'Ночная задача' });
  assert.equal(await nightRow.locator('.is-late').count(), 0);
  assert.match(await nightRow.locator('.gtl-due').innerText(), /7 ноя/);
  assert.deepEqual(errors, []);
  console.log("tasks-calendar-ui: ok");
} finally {
  await browser?.close();
  server.kill();
}
