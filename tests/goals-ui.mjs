import assert from "node:assert/strict";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5188",
    "--strictPort",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let browser,
  output = "";
server.stdout.on("data", (b) => (output += b));
server.stderr.on("data", (b) => (output += b));
try {
  let ready = false;
  for (let i = 0; i < 100 && server.exitCode === null; i++) {
    try {
      ready = (await fetch("http://127.0.0.1:5188/")).ok;
    } catch {
      /* Ожидаем запуск Vite. */
    }
    if (ready) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(ready, output);
  browser = await chromium.launch({
    executablePath: process.env.LIFEGAME_CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  await mkdir("work/goals", { recursive: true });
  for (const width of [1440, 360, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      isMobile: width < 500,
      hasTouch: width < 500,
      timezoneId: "Europe/Moscow",
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto("http://127.0.0.1:5188/");
    const ids = await page.evaluate(async () => {
      const { newAccountGame } = await import("/src/accountGame.ts"),
        { saveGoal, saveTask } = await import("/src/planning.ts"),
        { editStage } = await import("/src/goalSystem.ts");
      let state = newAccountGame("Проверка целей");
      state.profile.onboardingComplete = true;
      state = saveGoal(state, {
        name: "Проверочная цель",
        sphere: "english",
        progressMode: "tasks",
        reward: 200,
        target: 100,
      });
      const goal = state.goals.at(-1);
      state = editStage(state, goal.id, {
        name: "Разговорная практика",
        startsAt: "2026-03-01",
        dueAt: "2027-03-01",
        rewardXP: 35,
        rewardCoins: 10,
      });
      const stage = state.goals.at(-1).stages[0];
      state = editStage(state, goal.id, {
        name: "Следующий этап",
        requiresPrevious: true,
      });
      const locked = state.goals.at(-1).stages.at(-1);
      state = saveTask(state, {
        name: "Провести разговор",
        sphere: "english",
        difficulty: "Medium",
        goalId: goal.id,
        stageId: stage.id,
        dueAt: "2026-10-15T12:00:00Z",
      });
      localStorage.setItem("play-your-life-v1", JSON.stringify(state));
      return {
        goal: goal.id,
        stage: stage.id,
        locked: locked.id,
        task: state.quests.at(-1).id,
      };
    });
    await page
      .getByRole("button", { name: "Продолжить игру на этом устройстве" })
      .click();
    await page.goto(
      `http://127.0.0.1:5188/goals/${ids.goal}/stages/${ids.stage}`,
    );
    await page
      .getByRole("button", { name: "Продолжить игру на этом устройстве" })
      .click();
    await page
      .getByRole("heading", { name: "Этап 1. Разговорная практика" })
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `Переполнение ${width}`,
    );
    await page.getByLabel("Месяц календаря").selectOption("2");
    await page.getByLabel("Год календаря").fill("2026");
    const day = page.getByRole("button", { name: "2026-03-01", exact: true });
    await day.click();
    assert.equal(await day.getAttribute("data-start"), "true");
    await page
      .getByLabel("Заметки этапа")
      .fill("Настоящая заметка\nhttps://example.com");
    await page.getByRole("button", { name: "Сохранить заметки" }).click();
    await page.reload();
    await page
      .getByRole("button", { name: "Продолжить игру на этом устройстве" })
      .click();
    assert.equal(
      await page.getByLabel("Заметки этапа").inputValue(),
      "Настоящая заметка\nhttps://example.com",
    );
    await page
      .locator(".goal-task-title")
      .filter({ hasText: "Провести разговор" })
      .click();
    assert.ok(page.url().endsWith(`/tasks/${ids.task}`));
    await page
      .getByRole("button", { name: "Выполнить задачу", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Отменить выполнение", exact: true })
      .waitFor();
    const paid = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("play-your-life-v1")),
    );
    assert.equal(paid.quests.at(-1).done, true);
    await page
      .getByRole("button", { name: "Отменить выполнение", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Выполнить задачу", exact: true })
      .waitFor();
    const refunded = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("play-your-life-v1")),
    );
    assert.equal(refunded.xp, paid.xp - 20);
    assert.equal(refunded.coins, paid.coins - 4);
    await page.getByRole("button", { name: "Вернуться к этапу" }).click();
    await page
      .locator(".goal-stage-tabs")
      .getByRole("button", { name: "Статистика", exact: true })
      .click();
    await page.getByRole("heading", { name: "План и факт" }).waitFor();
    await page.getByRole("button", { name: "Обзор", exact: true }).click();
    await page
      .getByRole("button", { name: "+ Добавить задачу", exact: true })
      .click();
    await page.getByLabel("Название задачи").fill("Вторая обязательная задача");
    await page
      .getByRole("button", { name: "Сохранить задачу", exact: true })
      .click();
    await page
      .locator(".goal-task-title")
      .filter({ hasText: "Вторая обязательная задача" })
      .waitFor();
    const created = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("play-your-life-v1")),
    );
    assert.equal(created.quests.filter((q) => q.stageId).length, 2);
    assert.ok(
      created.goals.at(-1).history.find((e) => e.type === "task.created")
        ?.taskId,
    );
    await page
      .getByRole("button", { name: "Редактировать этап", exact: true })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Дата окончания (можно оставить пустой)")
      .fill("2027-04-01T12:00");
    await dialog
      .getByRole("button", { name: "Сохранить этап", exact: true })
      .click();
    await page
      .locator(".timeline-dates")
      .getByText("2027-04-01", { exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Дублировать этап", exact: true })
      .click();
    const duplicated = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("play-your-life-v1")),
    );
    assert.equal(duplicated.goals.at(-1).stages.length, 3);
    assert.equal(
      duplicated.quests.filter(
        (q) => q.stageId === duplicated.goals.at(-1).stages.at(-1).id,
      ).length,
      2,
    );
    await page.screenshot({
      path: `work/goals/stage-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Редактировать обложку" }).click();
    await page
      .getByRole("heading", { name: "Обложка цели", exact: true })
      .waitFor();
    assert.ok(
      await page
        .getByRole("status")
        .filter({ hasText: "Постоянное файловое хранилище" })
        .isVisible(),
    );
    await page.getByRole("button", { name: "Отмена", exact: true }).click();
    await page.goto(
      `http://127.0.0.1:5188/goals/${ids.goal}/stages/${ids.locked}`,
    );
    await page
      .getByRole("button", { name: "Продолжить игру на этом устройстве" })
      .click();
    await page.getByRole("heading", { name: "Этап заблокирован" }).waitFor();
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      `Цели: ${width}px, навигация, календарь, заметки, выполнение, возврат, аналитика, блокировка — OK`,
    );
  }
} finally {
  await browser?.close();
  server.kill();
}
