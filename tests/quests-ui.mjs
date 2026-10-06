import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
await mkdir("work", { recursive: true });
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5174",
    "--strictPort",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let browser;
try {
  await new Promise((resolve, reject) => {
    let errors = "";
    const timer = setTimeout(
      () => reject(new Error("Vite не запустился: " + errors)),
      10000,
    );
    server.stderr.on("data", (data) => {
      errors += String(data);
    });
    server.stdout.on("data", (data) => {
      if (String(data).includes("http://127.0.0.1:5174")) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error("Vite завершился " + code + ": " + errors));
    });
  });

  browser = await chromium.launch({
    executablePath: process.env.LIFEGAME_CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1100 },
      isMobile: mobile,
      hasTouch: mobile,
      timezoneId: "Europe/Moscow",
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:5174/");
    await page.evaluate(async () => {
      const { newAccountGame } = await import("/src/accountGame.ts");
      const s = newAccountGame("Игрок");
      s.profile.onboardingComplete = true;
      localStorage.setItem("play-your-life-v1", JSON.stringify(s));
    });
    await page
      .getByRole("button", { name: "Продолжить игру на этом устройстве" })
      .click();
    await page
      .locator(mobile ? ".mobile-nav" : ".sidebar")
      .getByRole("button", { name: /^Квесты/ })
      .click();
    assert.equal(await page.locator(".pyl-quest-spheres>button").count(), 9);
    await page
      .getByRole("button", { name: "＋ Создать квест" })
      .first()
      .click();
    let d = page.locator(".pyl-quest-dialog");
    await d.getByLabel("Название *").fill("Пробежать 10 км");
    await d.getByRole("button", { name: "Далее →" }).click();
    await d.getByRole("button", { name: "Спорт", exact: true }).click();
    await d.getByRole("button", { name: "Далее →" }).click();
    await d.locator("input[type=file]").setInputFiles({
      name: "cover.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jqCEAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await d.locator(".pyl-photo-preview img").waitFor();
    await d.getByRole("button", { name: "Далее →" }).click();
    await d.getByLabel("Цель / количество *").fill("10");
    await d.getByLabel("Единица измерения").fill("км");
    await d.getByRole("button", { name: "Далее →" }).click();
    await d.getByLabel("Life Coins").fill("101");
    await d.getByRole("button", { name: "Далее →" }).click();
    assert.equal(
      (await d.getByText("Награда", { exact: false }).count()) > 0,
      true,
    );
    await d.getByLabel("Life Coins").fill("100");
    await d.getByLabel("Виртуальная награда").selectOption("plant_basic");
    await d.getByRole("button", { name: "Далее →" }).click();
    await d.getByRole("button", { name: "Создать квест", exact: true }).click();
    const card = page
      .locator(".pyl-custom-card")
      .filter({ hasText: "Пробежать 10 км" });
    await card.getByRole("button", { name: "Продолжить", exact: true }).click();
    await page.locator(".pyl-overlay input").fill("3");
    await page
      .getByRole("button", { name: "Сохранить прогресс", exact: true })
      .click();
    await card.getByRole("button", { name: "Изменить" }).click();
    d = page.locator(".pyl-quest-dialog");
    for (let i = 0; i < 4; i++)
      await d.getByRole("button", { name: "Далее →" }).click();
    assert.equal(await d.getByLabel("Life Coins").isDisabled(), true);
    await d.getByRole("button", { name: "Закрыть", exact: true }).click();
    await card.getByRole("button", { name: "Продолжить", exact: true }).click();
    await page.getByRole("button", { name: "Выполнить полностью" }).click();
    await page.locator(".pyl-celebration button").click();
    await page.getByRole("button", { name: "В SPORT", exact: true }).click();
    await page
      .getByRole("button", { name: "＋ Добавить привычку" })
      .first()
      .click();
    d = page.locator(".pyl-quest-dialog");
    await d.getByLabel("Название *").fill("Выпить воду");
    await d.getByRole("button", { name: "Далее →" }).click();
    await d.getByRole("button", { name: "Здоровье", exact: true }).click();
    await d.getByRole("button", { name: "Чтение", exact: true }).click();
    await d.getByRole("button", { name: "Далее →" }).click();
    await d.getByLabel("Цель / количество *").fill("2");
    await d.getByRole("button", { name: "Далее →" }).click();
    await d.getByLabel("Life Coins").fill("10");
    await d.getByRole("button", { name: "Далее →" }).click();
    await d
      .getByRole("button", { name: "Создать привычку", exact: true })
      .click();
    await page
      .locator(".pyl-habit-card")
      .getByRole("button", { name: "Выполнить", exact: true })
      .click();
    assert.equal(
      await page
        .locator(".pyl-habit-card")
        .getByRole("button", { name: "✓ Выполнено", exact: true })
        .isDisabled(),
      true,
    );
    await page.reload();
    await page
      .getByRole("button", { name: "Продолжить игру на этом устройстве" })
      .click();
    await page
      .locator(mobile ? ".mobile-nav" : ".sidebar")
      .getByRole("button", { name: /^Квесты/ })
      .click();
    const state = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("play-your-life-v1")),
    );
    assert.equal(state.coins, 110);
    assert.equal(state.completed, 1);
    assert.equal(state.habitCompletions.length, 1);
    assert.equal(state.rewardInventory[0].placedIn, "sport");
    await page.getByPlaceholder("Поиск квестов...").fill("нет такой цели");
    assert.equal(await page.locator(".pyl-custom-card").count(), 0);
    await page.getByPlaceholder("Поиск квестов...").fill("");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    assert.equal(overflow, false);
    assert.deepEqual(errors, []);
    await page.screenshot({
      path: `work/quests-${mobile ? "mobile" : "desktop"}.png`,
      fullPage: true,
    });
    console.log(
      `${mobile ? "mobile" : "desktop"}: создание, фото-preview, лимиты, блокировка, награда, привычка, поиск и перезагрузка OK`,
    );
    await context.close();
  }
} finally {
  await browser?.close();
  server.kill();
}
