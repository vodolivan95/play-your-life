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
  for (const name of ["День", "Неделя", "2 недели", "Месяц"]) {
    await calendar.getByRole("button", { name, exact: true }).click();
    assert.equal(await calendar.getByRole("button", { name, exact: true }).getAttribute("aria-pressed"), "true");
  }
  // Месяц: у дня с семью задачами видны три и «ещё 4»; число разворачивает день, повторное нажатие — сворачивает.
  const cell = calendar.locator(".tcal-cell", { has: page.locator(".tcal-chip") });
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
  // Задача открывается из подробностей.
  await cell.first().locator(".tcal-chip").first().click();
  await calendar.locator(".tcal-detail").waitFor();
  // Окно задачи: награда, сложность и срок меняются и сохраняются.
  await calendar.getByRole("button", { name: "Открыть задачу" }).click();
  const win = page.locator(".twin");
  await win.waitFor();
  assert.match(await win.locator(".twin-ring").innerText(), /\+20/);
  assert.equal(await win.getByRole("button", { name: /^Сложная/ }).isDisabled(), true);
  await win.getByRole("button", { name: "Завтра", exact: true }).click();
  await win.getByRole("button", { name: "Выбрать дату" }).click();
  await win.locator("input[type=date]").waitFor();
  assert.equal(await win.getByRole("switch").isDisabled(), false);
  const tomorrow = await page.evaluate(async () => {
    const { dateKey } = await import("/src/game.ts");
    const d = new Date(); d.setDate(d.getDate() + 1); return dateKey(d);
  });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("play-your-life-v1")).quests.filter((q) => q.dueAt));
  assert.ok(saved.some((q) => q.dueAt === tomorrow));
  await win.getByRole("button", { name: "Каждый день" }).click();
  await win.getByLabel("Новая подзадача").fill("Первый шаг");
  await win.getByRole("button", { name: "＋ Добавить" }).click();
  await win.getByRole("checkbox").check();
  const rep = await page.evaluate(() => JSON.parse(localStorage.getItem("play-your-life-v1")).quests.filter((q) => q.repeat === "daily"));
  assert.equal(rep.length, 1);
  assert.deepEqual(rep[0].subtasks.map((t) => [t.title, t.done]), [["Первый шаг", true]]);
  await win.getByRole("button", { name: "Готово" }).click();
  await win.waitFor({ state: "detached" });
  assert.deepEqual(errors, []);
  console.log("tasks-calendar-ui: ok");
} finally {
  await browser?.close();
  server.kill();
}
