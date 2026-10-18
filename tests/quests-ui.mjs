import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";

// «Мои задачи» (бывшие «Квесты»): в левом меню — кнопка, на телефоне — в шторке «Ещё».
async function openTasks(page, mobile) {
  if (mobile) {
    await page.locator(".pyl-tabbar").getByRole("button", { name: /^Ещё/ }).click();
    await page.locator(".pyl-more").getByRole("button", { name: /^Мои задачи/ }).click();
  } else {
    await page.locator(".sidebar").getByRole("button", { name: /^Мои задачи/ }).click();
  }
}
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
  let serverOutput = "";
  server.stdout.on("data", (data) => {
    serverOutput += String(data);
  });
  server.stderr.on("data", (data) => {
    serverOutput += String(data);
  });
  const deadline = Date.now() + 30000;
  let ready = false;
  while (Date.now() < deadline && server.exitCode === null) {
    try {
      const response = await fetch("http://127.0.0.1:5174/", {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      /* Vite is still starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, "Vite не запустился: " + serverOutput);

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
    await openTasks(page, mobile);
    assert.equal(await page.locator(".pyl-quest-modes>button").count(), 3);
    await page
      .getByRole("button", { name: "＋ Новая задача" })
      .first()
      .click();
    let d = page.locator(".pyl-quest-dialog");
    await d.getByLabel("Название *").fill("Пробежать 10 км");
    await d.getByRole("button", { name: "Далее →" }).click();
    await d.getByRole("button", { name: "Спорт", exact: true }).click();
    await d.getByRole("button", { name: "Далее →" }).click();
    const fallback=d.locator('[data-quest-cover="master-city"]');
    await fallback.waitFor();
    assert.ok(await fallback.evaluate(async image=>{await image.decode();return image.naturalWidth===1280&&image.currentSrc.includes('/sphere-buildings/sport-building.jpg');}),'Обложка использует исходную фотографию Спорта, а не старый crop');
    await d.locator('.pyl-photo-preview').screenshot({path:`work/quest-cover-${mobile?'mobile':'desktop'}.png`});
    const uploaded=await page.evaluate(()=>{
      const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1200;
      const ctx=canvas.getContext('2d');const gradient=ctx.createLinearGradient(0,0,1920,1200);gradient.addColorStop(0,'#129de5');gradient.addColorStop(1,'#f7bf48');ctx.fillStyle=gradient;ctx.fillRect(0,0,1920,1200);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await d.locator("input[type=file]").setInputFiles({
      name: "cover.png",
      mimeType: "image/png",
      buffer: Buffer.from(uploaded,"base64"),
    });
    await d.locator(".pyl-photo-preview img").waitFor();
    await page.waitForFunction(()=>document.querySelector('.pyl-photo-preview img')?.src.startsWith('blob:'));
    assert.deepEqual(await d.locator('.pyl-photo-preview img').evaluate(async image=>{await image.decode();return [image.naturalWidth,image.naturalHeight];}),[1920,1200]);
    assert.equal(await d.locator('.pyl-photo-preview img').evaluate(async image=>{const bytes=new Uint8Array(await (await fetch(image.src)).arrayBuffer());return btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''));}),uploaded,'Фото не перекодируется');
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
    await d.getByRole("button", { name: "Создать задачу", exact: true }).click();
    const card = page
      .locator(".gtl-item")
      .filter({ hasText: "Пробежать 10 км" });
    await card.getByRole("button", { name: "Продолжить", exact: true }).click();
    await page.locator(".pyl-overlay input").fill("3");
    await page
      .getByRole("button", { name: "Сохранить прогресс", exact: true })
      .click();
    await card.locator(".gtl-row").click();
    await page.getByRole("dialog", { name: /Пробежать 10 км/ }).getByRole("button", { name: "Расширенные настройки" }).click();
    d = page.locator(".pyl-quest-dialog");
    for (let i = 0; i < 4; i++)
      await d.getByRole("button", { name: "Далее →" }).click();
    assert.equal(await d.getByLabel("Life Coins").isDisabled(), true);
    await d.getByRole("button", { name: "Закрыть", exact: true }).click();
    await card.getByRole("button", { name: "Продолжить", exact: true }).click();
    await page.getByRole("button", { name: "Выполнить полностью" }).click();
    await page.locator(".pyl-celebration button").click();
    await page.reload();
    await page
      .getByRole("button", { name: "Продолжить игру на этом устройстве" })
      .click();
    await openTasks(page, mobile);
    const state = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("play-your-life-v1")),
    );
    assert.equal(state.coins, 100);
    assert.equal(state.completed, 1);
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
} catch (error) {
  console.log('::error::' + String(error?.message ?? error).slice(0, 1200).replace(/\n/g, '%0A'));
  throw error;
} finally {
  await browser?.close();
  server.kill();
}
