/* global fetch, setTimeout, document, innerWidth */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import process from 'node:process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { stdio: 'ignore' });
await mkdir('room-preview', { recursive: true });
let browser;
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch('http://localhost:4173')).ok) break; } catch { /* Vite запускается. */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, hasTouch: true });
  const errors = [], failedAssets = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().includes('/assets/') && response.status() >= 400) failedAssets.push(response.url()); });
  await page.goto('http://localhost:4173/?room-demo=sport');
  const map = page.locator('.coastal-map');
  await map.waitFor();
  await page.waitForFunction(() => { const image = document.querySelector('.coastal-map > img'); return image?.complete && image.naturalWidth === 1005; });
  assert.equal(await page.locator('.coastal-building').count(), 9);
  assert.equal(await page.locator('.city3d-scene canvas').count(), 0, 'Внешний город заменён картой');
  await page.screenshot({ path: 'room-preview/coastal-desktop.png', fullPage: true });
  const ids = ['health', 'sport', 'growth', 'finance', 'english', 'driving', 'together', 'tasks', 'hobby'];
  // Все входы находятся внутри изображения и открывают существующий экран своей сферы.
  for (const id of ids.filter(id => id !== 'sport')) {
    const button = page.locator(`[data-building="${id}"]`);
    await button.scrollIntoViewIfNeeded();
    await button.click();
    await page.getByText('3D-интерьер этой сферы готовится.', { exact: false }).waitFor();
    await page.getByRole('button', { name: '← Вернуться в город', exact: true }).click();
    assert.equal(await page.locator('.coastal-building').count(), 9);
  }
  for (const time of ['day', 'sunset', 'night']) {
    await page.getByRole('combobox', { name: 'Время города', exact: true }).selectOption(time);
    for (const weather of ['clear', 'partlyCloudy', 'cloudy', 'rain', 'thunderstorm', 'fog', 'snow']) {
      await page.getByRole('combobox', { name: 'Погода города', exact: true }).selectOption(weather);
      assert.equal(await map.getAttribute('data-weather'), weather);
      assert.equal(await map.getAttribute('data-time'), time);
    }
  }
  await page.getByRole('button', { name: '⏸ Пауза', exact: true }).click();
  assert.equal(await map.getAttribute('data-paused'), 'true');
  await page.getByRole('button', { name: '▶ Продолжить', exact: true }).click();
  await page.getByRole('combobox', { name: 'Время города', exact: true }).selectOption('day');
  await page.getByRole('combobox', { name: 'Погода города', exact: true }).selectOption('clear');
  await page.waitForTimeout(1100);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const rects = await page.locator('.coastal-building').evaluateAll(nodes => nodes.map(node => {
    const bounds = node.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height };
  }));
  assert.ok(rects.every(rect => rect.width >= 44 && rect.height >= 44), 'Все девять входов доступны пальцем');
  await page.screenshot({ path: 'room-preview/coastal-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Увеличить карту', exact: true }).click();
  assert.equal(await map.evaluate(node => node.getBoundingClientRect().width > node.parentElement.clientWidth), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.getByRole('button', { name: 'Весь остров', exact: true }).click();
  const sport = page.locator('[data-building="sport"]');
  await sport.scrollIntoViewIfNeeded();
  const bounds = await sport.boundingBox();
  await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.locator('.room3d canvas[data-ready="true"]').waitFor();
  await page.getByRole('button', { name: 'Вернуться из комнаты' }).click();
  await map.waitFor();
  await page.reload();
  await map.waitFor();
  assert.equal(await page.locator('.coastal-building').count(), 9);
  assert.deepEqual(errors, []);
  assert.deepEqual(failedAssets, []);
  await writeFile('room-preview/coastal-result.json', JSON.stringify({ passed: true, buildings: ids, combinations: 21, mobileEntry: true, errors }, null, 2));
} catch (error) {
  await writeFile('room-preview/coastal-error.txt', String(error.stack || error));
  throw error;
} finally {
  await browser?.close();
  if (server.exitCode === null && server.signalCode === null) {
    const stopped = once(server, 'exit');
    server.kill('SIGTERM');
    await stopped;
  }
}
