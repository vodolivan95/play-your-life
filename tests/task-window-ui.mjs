import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
await mkdir("work/task-window", { recursive: true });
const origin = process.env.TASK_TEST_ORIGIN || "http://127.0.0.1:5196";
const server = process.env.TASK_TEST_ORIGIN
  ? null
  : spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        "5196",
        "--strictPort",
      ],
      { stdio: "ignore" },
    );
let ready = false;
for (const until = Date.now() + 30000; Date.now() < until;) {
  try {
    ready = (await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok;
  } catch {
    /* Vite starts */
  }
  if (ready) break;
  await new Promise((resolve) => setTimeout(resolve, 100));
}
if (!ready) {
  server?.kill();
  throw new Error("Vite не запустился");
}
const browser = await chromium.launch({
  executablePath: process.env.LIFEGAME_CHROMIUM_PATH || undefined,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const errors = [];

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    timezoneId: "Europe/Moscow",
    locale: "ru-RU",
  });
  const p = await context.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`${origin}/?local-preview=1#/tasks/english-1`);
  if (
    await p
      .getByRole("button", { name: "Сначала посмотреть демо", exact: true })
      .count()
  )
    await p
      .getByRole("button", { name: "Сначала посмотреть демо", exact: true })
      .click();
  let dialog = p.locator("section.twin");
  await dialog.waitFor();
  await dialog.getByText("Фокус:", { exact: false }).first().waitFor();
  for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    await p.setViewportSize({ width, height: 1200 });
    const overflow = await dialog.evaluate((el) => ({
      scroll: el.scrollWidth,
      client: el.clientWidth,
    }));
    assert.ok(
      overflow.scroll <= overflow.client + 1,
      `overflow at ${width}: ${JSON.stringify(overflow)}`,
    );
    const doc = await p.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    assert.ok(
      doc.scroll <= doc.client + 1,
      `page overflow ${width}: ${JSON.stringify(doc)}`,
    );
    if ([390, 1440].includes(width)) {
      await p.setViewportSize({ width, height: width === 390 ? 3000 : 1500 });
      await dialog.screenshot({
        path: `work/task-window/${width === 390 ? "mobile" : "desktop"}.png`,
      });
    }
  }
  await p.setViewportSize({ width: 1440, height: 1200 });
  await dialog
    .getByLabel("Название задачи", { exact: true })
    .fill("Проверка сохранения 🧭");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await p.goto(`${origin}/?local-preview=1#/tasks/english-1`);
  await p.reload();
  dialog = p.locator("section.twin");
  assert.equal(
    await dialog.getByLabel("Название задачи", { exact: true }).inputValue(),
    "Проверка сохранения 🧭",
  );
  await dialog.getByLabel("Проект", { exact: true }).selectOption("b2");
  await dialog.getByLabel("Статус", { exact: true }).selectOption("doing");
  await dialog
    .getByLabel("Приоритет задачи", { exact: true })
    .selectOption("critical");
  await dialog
    .getByLabel("Новый пункт", { exact: true })
    .fill("Проверить маршрут");
  await dialog.getByRole("button", { name: "Добавить", exact: true }).click();
  await dialog
    .getByLabel("Выполнить: Проверить маршрут", { exact: true })
    .check();
  await dialog
    .getByLabel("Адрес", { exact: true })
    .fill("Москва, Красная площадь");
  await dialog
    .getByRole("heading", { name: "♧ Место выполнения", exact: true })
    .click();
  const href = await dialog
    .getByRole("link", { name: "📍 Маршрут в Яндекс Картах ↗", exact: true })
    .getAttribute("href");
  assert.equal(
    new URL(href).searchParams.get("rtext"),
    "~Москва, Красная площадь",
  );
  await dialog.getByLabel("Новый тег", { exact: true }).fill("Проверка");
  await dialog.getByRole("button", { name: "＋", exact: true }).click();
  await dialog.getByRole("tab", { name: "Описание", exact: false }).click();
  await dialog
    .getByLabel("Описание задачи", { exact: true })
    .fill("Текст\n[Сайт](https://example.org)\n<script>alert(1)</script>");
  assert.equal(await dialog.locator("script").count(), 0);
  await dialog.getByRole("tab", { name: "Заметки", exact: false }).click();
  await dialog
    .getByLabel("Текст заметки", { exact: true })
    .fill("Отдельная заметка");
  await dialog
    .getByRole("button", { name: "Добавить заметку", exact: true })
    .click();
  await dialog.getByRole("tab", { name: "Вложения", exact: false }).click();
  await dialog
    .getByLabel("Добавить фото", { exact: true })
    .setInputFiles("public/logo-256.png");
  await dialog
    .getByRole("button", { name: "Сделать обложкой", exact: true })
    .click();
  assert.equal(
    await dialog
      .getByRole("button", { name: "Открыть обложку", exact: true })
      .count(),
    1,
  );
  await dialog.getByRole("tab", { name: "История", exact: false }).click();
  await dialog.getByText("Изменено: проект", { exact: true }).waitFor();
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await p.reload();
  dialog = p.locator("section.twin");
  await dialog.waitFor();
  assert.equal(
    await dialog.getByLabel("Проект", { exact: true }).inputValue(),
    "b2",
  );
  assert.equal(
    await dialog.getByLabel("Приоритет задачи", { exact: true }).inputValue(),
    "critical",
  );
  assert.equal(
    await dialog.getByLabel("Адрес", { exact: true }).inputValue(),
    "Москва, Красная площадь",
  );
  assert.equal(
    await dialog
      .getByLabel("Выполнить: Проверить маршрут", { exact: true })
      .isChecked(),
    true,
  );
  assert.equal(
    await dialog
      .getByRole("button", { name: "Открыть обложку", exact: true })
      .count(),
    1,
  );
  await dialog.getByRole("tab", { name: "Вложения", exact: false }).click();
  assert.equal(
    await dialog.getByText("logo-256.png", { exact: true }).count(),
    1,
  );
  await dialog.getByRole("tab", { name: "Планирование", exact: false }).click();
  const xpBefore = await p.evaluate(() => JSON.parse(localStorage.getItem('play-your-life-v1')).spheres.english.xp);
  await dialog.getByRole('button', {name:'✓ Выполнить',exact:true}).click();
  await p.reload();
  dialog = p.locator('section.twin');
  await dialog.waitFor();
  assert.equal(await dialog.getByLabel('Статус',{exact:true}).inputValue(), 'completed');
  const xpAfter = await p.evaluate(() => JSON.parse(localStorage.getItem('play-your-life-v1')).spheres.english.xp);
  assert.ok(xpAfter >= xpBefore);
  await dialog.getByLabel('Статус',{exact:true}).selectOption('doing');
  assert.equal(await dialog.getByLabel('Статус',{exact:true}).inputValue(), 'doing');
  await dialog.getByRole('button', {name:'✓ Выполнить',exact:true}).click();
  await p.reload();
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('play-your-life-v1')).spheres.english.xp), xpAfter, 'повторное выполнение не выдаёт XP дважды');
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 6 widths, tabs, title/description save + reload, project, status, priority, checklist, tags, notes, real history, safe text, Yandex URL.",
  );
  await context.close();
} finally {
  await browser.close();
  server?.kill();
}
