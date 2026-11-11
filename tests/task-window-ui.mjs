import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
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
  async function touchScreenshot(path, savedState) {
    const touch = await browser.newContext({
      viewport: { width: 390, height: 3200 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
      locale: "ru-RU",
      timezoneId: "Europe/Moscow",
    });
    if (savedState)
      await touch.addInitScript(
        (state) => localStorage.setItem("play-your-life-v1", state),
        savedState,
      );
    const page = await touch.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${origin}/?local-preview=1#/tasks/english-1`);
    const window = page.locator("section.twin");
    await window.waitFor();
    await window.locator(".focus").waitFor();
    assert.ok(
      await window.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      "touch viewport overflow",
    );
    await window.screenshot({ path });
    await touch.close();
  }
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
  await dialog.locator(".focus").getByRole("heading", { name: "Фокус", exact: true }).waitFor();
  // The direct review URL uses a legacy starter task without sourceType.
  for (const level of ["Micro", "Simple", "Medium", "Hard", "Very Hard"]) {
    await dialog.getByLabel("Сложность", { exact: true }).selectOption(level);
    assert.equal(await dialog.getByLabel("Сложность", { exact: true }).inputValue(), level);
  }
  await p.reload();
  await dialog.waitFor();
  assert.equal(await dialog.getByLabel("Сложность", { exact: true }).inputValue(), "Very Hard");
  await dialog.getByLabel("Сложность", { exact: true }).selectOption("Medium");

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
  await touchScreenshot("work/task-window/mobile.png");
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
  const favorite = dialog.getByRole("button", {
    name: "Избранное",
    exact: true,
  });
  await favorite.click();
  assert.equal(await favorite.getAttribute("aria-pressed"), "true");
  await favorite.click();
  assert.equal(await favorite.getAttribute("aria-pressed"), "false");
  await dialog.getByLabel("Проект", { exact: true }).selectOption("b2");
  await dialog.getByLabel("Оценка времени", { exact: true }).selectOption("60");
  assert.equal(
    await dialog.getByLabel("Оценка времени", { exact: true }).inputValue(),
    "60",
  );
  await dialog.getByLabel("Статус", { exact: true }).selectOption("doing");
  await dialog
    .getByLabel("Приоритет задачи", { exact: true })
    .selectOption("critical");
  await dialog
    .getByRole("button", { name: "Добавить пункт", exact: true })
    .click();
  await dialog
    .getByLabel("Новый пункт", { exact: true })
    .fill("Проверить маршрут");
  await dialog.getByRole("button", { name: "Добавить", exact: true }).click();
  await dialog
    .getByLabel("Выполнить: Проверить маршрут", { exact: true })
    .check();
  await dialog
    .getByRole("button", { name: "Настроить место выполнения", exact: true })
    .click();
  await dialog
    .getByLabel("Адрес", { exact: true })
    .fill("Москва, Красная площадь");
  await dialog
    .getByRole("heading", { name: "Место выполнения", exact: true })
    .click();
  const href = await dialog
    .getByRole("link", { name: "Маршрут в Яндекс Картах", exact: true })
    .getAttribute("href");
  assert.equal(
    new URL(href).searchParams.get("rtext"),
    "~Москва, Красная площадь",
  );
  await dialog
    .getByRole("button", { name: "Добавить тег", exact: true })
    .click();
  await dialog.getByLabel("Новый тег", { exact: true }).fill("Проверка");
  await dialog
    .getByRole("button", { name: "Добавить тег", exact: true })
    .click();
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
  // Hold image decoding while another metadata edit is saved.
  await p.evaluate(() => {
    const nativeDecode = Image.prototype.decode;
    Image.prototype.decode = async function () {
      if (this.src.startsWith("blob:")) {
        await new Promise((resolve) => {
          window.releaseTaskPhoto = resolve;
        });
      }
      return nativeDecode.call(this);
    };
    window.restoreTaskDecode = () => {
      Image.prototype.decode = nativeDecode;
    };
  });
  await dialog
    .getByLabel("Добавить фото", { exact: true })
    .setInputFiles("public/logo-256.png");
  await p.waitForFunction(
    () => typeof window.releaseTaskPhoto === "function",
  );
  await dialog.getByRole("tab", { name: "Заметки", exact: false }).click();
  await dialog
    .getByLabel("Текст заметки", { exact: true })
    .fill("Заметка во время загрузки");
  await dialog
    .getByRole("button", { name: "Добавить заметку", exact: true })
    .click();
  await p.evaluate(() => {
    window.releaseTaskPhoto();
    window.restoreTaskDecode();
  });
  await dialog.getByRole("tab", { name: "Вложения", exact: false }).click();

  await dialog
    .getByRole("button", { name: "Сделать обложкой", exact: true })
    .click();
  assert.equal(
    await dialog
      .getByRole("button", { name: "Открыть обложку", exact: true })
      .count(),
    1,
  );
  await dialog.getByRole("tab", { name: "Заметки", exact: false }).click();
  await dialog
    .getByText("Заметка во время загрузки", { exact: true })
    .waitFor();
  await dialog.getByRole("tab", { name: "Вложения", exact: false }).click();
  const firstCover = await dialog
    .locator(".twin-cover-image img")
    .getAttribute("src");
  await dialog
    .getByLabel("Добавить фото", { exact: true })
    .setInputFiles("public/icon-192.png");
  await dialog
    .getByRole("button", { name: "Следующая обложка", exact: true })
    .waitFor();
  await dialog
    .getByRole("button", { name: "Следующая обложка", exact: true })
    .click();
  assert.notEqual(
    await dialog.locator(".twin-cover-image img").getAttribute("src"),
    firstCover,
  );
  await dialog
    .getByRole("button", { name: "Предыдущая обложка", exact: true })
    .click();
  assert.equal(
    await dialog.locator(".twin-cover-image img").getAttribute("src"),
    firstCover,
  );
  await dialog
    .getByRole("button", { name: "Изменить обложку", exact: true })
    .click();
  assert.equal(
    await dialog
      .getByRole("button", {
        name: "Использовать первое фото TickTick",
        exact: true,
      })
      .isDisabled(),
    true,
  );
  await dialog
    .getByRole("button", { name: "Изменить обложку", exact: true })
    .click();
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
  await dialog
    .getByRole("button", { name: "Настроить место выполнения", exact: true })
    .click();
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
  if (await dialog.getByRole("button", { name: "Готово", exact: true }).count())
    await dialog.getByRole("button", { name: "Готово", exact: true }).click();
  for (const width of [1440, 390]) {
    await p.setViewportSize({ width, height: width === 390 ? 3000 : 1600 });
    assert.ok(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    );
    await dialog.screenshot({
      path: `work/task-window/${width === 390 ? "mobile" : "desktop"}-populated.png`,
    });
  }
  await p.setViewportSize({ width: 1440, height: 1200 });
  await touchScreenshot(
    "work/task-window/mobile-populated.png",
    await p.evaluate(() => localStorage.getItem("play-your-life-v1")),
  );
  const countBeforeDuplicate = await p.evaluate(
    () => JSON.parse(localStorage.getItem("play-your-life-v1")).quests.length,
  );
  await dialog
    .locator(".twin-toolbar")
    .getByRole("button", { name: "Дублировать", exact: true })
    .dblclick();
  await p.waitForFunction(
    (count) =>
      JSON.parse(localStorage.getItem("play-your-life-v1")).quests.length ===
      count + 1,
    countBeforeDuplicate,
  );
  const [templateDownload] = await Promise.all([
    p.waitForEvent("download"),
    dialog
      .locator(".twin-foot")
      .getByRole("button", { name: "Сохранить как шаблон", exact: true })
      .click(),
  ]);
  assert.equal(
    templateDownload.suggestedFilename(),
    "play-your-life-task-template.json",
  );
  const xpBefore = await p.evaluate(
    () =>
      JSON.parse(localStorage.getItem("play-your-life-v1")).spheres.english.xp,
  );
  await dialog.getByRole("button", { name: "Выполнить", exact: true }).click();
  await p.reload();
  dialog = p.locator("section.twin");
  await dialog.waitFor();
  assert.equal(
    await dialog.getByLabel("Статус", { exact: true }).inputValue(),
    "completed",
  );
  const xpAfter = await p.evaluate(
    () =>
      JSON.parse(localStorage.getItem("play-your-life-v1")).spheres.english.xp,
  );
  assert.ok(xpAfter >= xpBefore);
  await dialog.getByLabel("Статус", { exact: true }).selectOption("doing");
  assert.equal(
    await dialog.getByLabel("Статус", { exact: true }).inputValue(),
    "doing",
  );
  await dialog.getByRole("button", { name: "Выполнить", exact: true }).click();
  await p.reload();
  assert.equal(
    await p.evaluate(
      () =>
        JSON.parse(localStorage.getItem("play-your-life-v1")).spheres.english
          .xp,
    ),
    xpAfter,
    "повторное выполнение не выдаёт XP дважды",
  );
  dialog = p.locator("section.twin");
  await dialog.waitFor();
  p.once("dialog", (d) => d.dismiss());
  await dialog
    .locator(".twin-foot")
    .getByRole("button", { name: "Удалить", exact: true })
    .click();
  assert.ok(
    await p.evaluate(() =>
      JSON.parse(localStorage.getItem("play-your-life-v1")).quests.some(
        (q) => q.id === "english-1",
      ),
    ),
  );
  p.once("dialog", (d) => d.accept());
  await dialog
    .locator(".twin-foot")
    .getByRole("button", { name: "Удалить", exact: true })
    .click();
  await p.waitForFunction(
    () =>
      !JSON.parse(localStorage.getItem("play-your-life-v1")).quests.some(
        (q) => q.id === "english-1",
      ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 6 widths, tabs, title/description save + reload, project, status, priority, checklist, tags, notes, real history, safe text, Yandex URL.",
  );
  await context.close();
  // A remote deletion can remove the task without unmounting the parent editor.
  // The page must remain scrollable after that state change.
  const fixtureBase = "work/task-window/remote-delete";
  await writeFile(
    fixtureBase + ".html",
    '<!doctype html><meta charset="utf-8"><style>body{margin:0;height:2000px}.pyl-overlay{position:fixed;inset:0}</style><div id="root"></div><script type="module" src="/work/task-window/remote-delete.tsx"></script>',
  );
  await writeFile(
    fixtureBase + ".tsx",
    `
import React, {useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import TaskWindow from '../../src/components/TaskWindow';
import {initialState} from '../../src/game';
function Case(){const [s,set]=useState(initialState);useEffect(()=>{const timer=setTimeout(()=>set(v=>({...v,quests:[]})),1000);return()=>clearTimeout(timer)},[]);return <TaskWindow state={s} taskId="english-1" today="2026-11-11" onChange={set} onClose={()=>{}} notify={()=>{}}/>}
createRoot(document.getElementById('root')!).render(<Case/>);
`,
  );
  const remoteContext = await browser.newContext({
    viewport: { width: 1440, height: 800 },
  });
  const remote = await remoteContext.newPage();
  await remote.clock.install();
  await remote.goto(`${origin}/${fixtureBase}.html`);
  await remote.locator(".twin").waitFor();
  assert.equal(
    await remote.evaluate(() => document.body.style.overflow),
    "hidden",
  );
  await remote.clock.fastForward(1200);
  await remote.locator(".twin").waitFor({ state: "detached" });
  await remote.waitForFunction(() => document.body.style.overflow !== "hidden");
  assert.notEqual(
    await remote.evaluate(() => document.body.style.overflow),
    "hidden",
  );
  assert.ok(
    await remote.evaluate(() => {
      scrollTo(0, 500);
      return scrollY > 0;
    }),
  );
  await remoteContext.close();
  await Promise.all([rm(fixtureBase + ".html"), rm(fixtureBase + ".tsx")]);
} finally {
  await browser.close();
  server?.kill();
}
