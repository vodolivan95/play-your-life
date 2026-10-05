import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const saveKey = 'play-your-life-3d-sport-demo-v1';
const server = spawn('npm', ['run', 'preview', '--', '--port', '4173'], { stdio: 'ignore' });
await mkdir('room-preview', { recursive: true });
let browser;
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:4173')).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 500)); }
  browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));

  await page.goto('http://localhost:4173/?room-demo=sport');
  await page.locator('.room3d canvas').waitFor();
  await page.waitForTimeout(4000);
  assert.equal(await page.locator('.room3d-unavailable').count(), 0, '3D сцена должна загрузиться');
  await page.screenshot({ path: 'room-preview/sport-empty.png' });
  await page.getByRole('button', { name: 'Магазин', exact: true }).click();
  const treadmill = page.locator('.room3d-catalog article').filter({ hasText: 'Беговая дорожка' });
  await treadmill.getByRole('button', { name: 'Купить', exact: true }).click();
  await page.getByRole('button', { name: 'Закрыть панель' }).click();
  await page.getByRole('button', { name: 'Инвентарь', exact: true }).click();
  await page.locator('.room3d-catalog article').filter({ hasText: 'Беговая дорожка' }).getByRole('button', { name: 'Установить', exact: true }).click();
  await page.getByRole('button', { name: 'Сдвинуть вправо' }).click();
  await page.getByRole('button', { name: 'Повернуть', exact: true }).click();
  await page.getByRole('button', { name: '✓ Установить', exact: true }).click();
  await page.waitForTimeout(1200);
  const saved = JSON.parse(await page.evaluate(key => localStorage.getItem(key), saveKey));
  assert.equal(saved.coins, 1200);
  assert.deepEqual(saved.rooms.sport.objects[0].position, [1, 0, 0]);
  assert.equal(saved.rooms.sport.objects[0].rotation[1], Math.PI / 2);
  await page.getByRole('button', { name: '✓ Готово', exact: true }).click();
  await page.screenshot({ path: 'room-preview/sport-treadmill.png' });
  const canvas = page.locator('.room3d canvas'); const bounds = await canvas.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width / 2 + 120, bounds.y + bounds.height / 2 - 40, { steps: 10 }); await page.mouse.up();
  await page.mouse.wheel(0, -160); await page.waitForTimeout(1000);
  await page.screenshot({ path: 'room-preview/sport-angle.png' });
  await page.reload();

  await page.locator('.room3d canvas').waitFor();
  await page.waitForTimeout(2000);
  const reloaded = JSON.parse(await page.evaluate(key => localStorage.getItem(key), saveKey));
  assert.deepEqual(reloaded.rooms.sport.objects, saved.rooms.sport.objects);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Настройки комнаты' }).click();
  await page.getByRole('combobox', { name: 'Время суток' }).selectOption('night');
  await page.getByRole('button', { name: 'Закрыть панель' }).click();
  await page.screenshot({ path: 'room-preview/sport-mobile-night.png' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  await writeFile('room-preview/result.json', JSON.stringify({ passed: true, coins: reloaded.coins, object: reloaded.rooms.sport.objects[0], errors }, null, 2));
} catch (error) {
  await writeFile('room-preview/error.txt', String(error.stack || error)); throw error;
} finally { await browser?.close(); server.kill('SIGTERM'); }
