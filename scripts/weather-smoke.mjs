/* global fetch, setTimeout, document */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const server = spawn('npm', ['run', 'preview', '--', '--port', '4173'], { stdio: 'ignore' });
await mkdir('room-preview', { recursive: true });
let browser, page;
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:4173')).ok) break; } catch { /* Vite starts. */ } await new Promise(r => setTimeout(r, 500)); }
  browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  page = await browser.newPage({ viewport: { width: 1280, height: 900 }, hasTouch: true });
  const errors = []; const failedAssets = []; page.on('response', r => { if (r.url().includes('/models/city/') && !r.ok()) failedAssets.push(r.url()); }); page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:4173/?room-demo=sport');
  const canvas = page.locator('.city3d-scene canvas[data-ready="true"]'); await canvas.waitFor();
  const manifest = await (await page.request.get('http://localhost:4173/models/city/manifest.json')).json();
  assert.equal(manifest.length, 13); assert.ok(manifest.reduce((sum, entry) => sum + entry.bytes, 0) < 10 * 1024 * 1024, 'GLB города укладываются в мобильный бюджет');
  await writeFile('room-preview/city-manifest.json', JSON.stringify(manifest, null, 2));
  await canvas.scrollIntoViewIfNeeded(); await page.waitForTimeout(1800);
  await page.screenshot({ path: 'room-preview/island-day.png' });
  await page.locator('.city3d-dev summary').click();
  await page.getByRole('combobox', { name: 'Качество города' }).selectOption('low');
  for (const time of ['day', 'sunset', 'night']) {
    await page.getByRole('combobox', { name: 'Время 3D-города' }).selectOption(time);
    for (const weather of ['clear', 'partlyCloudy', 'cloudy', 'rain', 'thunderstorm', 'fog', 'snow']) {
      await page.getByRole('combobox', { name: 'Погода города' }).selectOption(weather);
      await page.waitForFunction(({ weather, time }) => document.querySelector('.city3d-scene canvas')?.getAttribute('data-weather') === weather && document.querySelector('.city3d-scene canvas')?.getAttribute('data-time') === time, { weather, time });
      assert.equal(await canvas.getAttribute('data-weather'), weather); assert.equal(await canvas.getAttribute('data-time'), time);
    }
  }
  await page.getByRole('combobox', { name: 'Погода города' }).selectOption('rain');
  await page.waitForTimeout(23000);
  const wet = Number(await canvas.getAttribute('data-wetness')); assert.ok(wet > .05, 'Дождь увлажняет дороги');
  assert.ok(Number(await canvas.getAttribute('data-traffic-speed')) < .9);
  await canvas.scrollIntoViewIfNeeded(); await page.screenshot({ path: 'room-preview/city-night-rain.png' });
  await page.getByRole('combobox', { name: 'Погода города' }).selectOption('clear'); await page.waitForTimeout(1000);
  assert.ok(Number(await canvas.getAttribute('data-wetness')) > wet * .9, 'Дорога не высыхает мгновенно');
  await page.getByRole('combobox', { name: 'Погода города' }).selectOption('fog'); await page.waitForTimeout(6000);
  assert.ok(Number(await canvas.getAttribute('data-fog')) > .015);
  await page.screenshot({ path: 'room-preview/city-night-fog.png' });
  await page.getByRole('combobox', { name: 'Погода города' }).selectOption('snow'); await page.waitForTimeout(12000);
  assert.ok(Number(await canvas.getAttribute('data-snow-amount')) > .01);
  await page.screenshot({ path: 'room-preview/city-night-snow.png' });
  for (const q of ['medium', 'high', 'auto', 'low']) await page.getByRole('combobox', { name: 'Качество города' }).selectOption(q);
  await page.getByRole('combobox', { name: 'Время 3D-города' }).selectOption('day');
  await page.getByRole('combobox', { name: 'Погода города' }).selectOption('clear');
  await page.waitForTimeout(18000);
  await page.setViewportSize({ width: 390, height: 844 }); await canvas.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'room-preview/city-mobile.png' });
  const rect = await canvas.boundingBox(); const [x, y] = (await canvas.getAttribute('data-sport-point')).split(',').map(Number);
  await page.touchscreen.tap(rect.x + x, rect.y + y); await page.locator('.room3d canvas[data-ready="true"]').waitFor();
  await page.getByRole('button', { name: 'Вернуться из комнаты' }).click(); await canvas.waitFor();
  assert.equal(await page.evaluate(() => document.querySelectorAll('.city3d-scene canvas').length), 1);
  assert.deepEqual(failedAssets, [], 'Все GLB должны загрузиться');
  assert.deepEqual(errors, []);
  await writeFile('room-preview/weather-result.json', JSON.stringify({ passed: true, combinations: 21, wetnessAfterRain: wet, mobileEntry: true, errors }, null, 2));
} catch (error) { await page?.screenshot({ path: 'room-preview/weather-failure.png' }); await writeFile('room-preview/weather-error.txt', String(error.stack || error)); throw error; }
finally { await browser?.close(); server.kill('SIGTERM'); }
