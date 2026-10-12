/* global fetch, setTimeout, localStorage */
// «Вождение»: вход из здания на карте, покупка и расстановка мебели, снимки ПК и телефона.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import process from 'node:process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const saveKey = 'play-your-life-3d-sport-demo-v1';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4178', '--strictPort'], { stdio: 'ignore' });
await mkdir('room-preview', { recursive: true });
let browser;
async function enterRoom(page) {
  const building = page.locator('[data-building="driving"]');
  await building.waitFor(); await building.scrollIntoViewIfNeeded(); await building.click();
  await page.locator('.room3d canvas[data-ready="true"]').waitFor();
}
async function setView(page, time, quality) {
  await page.getByRole('button', { name: 'Настройки комнаты' }).click();
  await page.getByRole('combobox', { name: 'Время суток' }).selectOption(time);
  await page.getByRole('combobox', { name: 'Качество' }).selectOption(quality);
  await page.getByRole('button', { name: 'Закрыть панель' }).click();
  await page.waitForTimeout(1800);
}
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:4178')).ok) break; } catch { /* Vite ещё запускается. */ } await new Promise(resolve => setTimeout(resolve, 500)); }
  browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:4178/?room-demo=sport');
  await page.getByRole('heading', { name: 'Общая карта', exact: true }).waitFor();
  await enterRoom(page);
  assert.equal(await page.locator('section[aria-label="3D-комната Вождение"]').count(), 1);
  assert.equal(await page.locator('.room3d-unavailable').count(), 0, '3D сцена должна загрузиться');
  await setView(page, 'sunset', 'high');
  await page.screenshot({ path: 'room-preview/driving-empty.png' });
  await page.getByRole('button', { name: 'Магазин', exact: true }).click();
  await page.screenshot({ path: 'room-preview/driving-shop.png' });
  assert.equal(await page.locator('.room3d-catalog article').count(), 6);
  assert.equal(await page.locator('.room3d-catalog article').filter({ hasText: 'Мотоцикл' }).getByRole('button').isDisabled(), true, 'Мотоцикл открывается на 3 уровне');
  await page.getByRole('button', { name: 'Закрыть панель' }).click();
  const placements = [
    { name: 'Автосимулятор', x: 0, z: -3.5 }, { name: 'Светофор', x: 4.5, z: -3.5 },
    { name: 'Стопка шин', x: -4.5, z: 2 }, { name: 'Тележка с инструментами', x: -3, z: -3.5 },
  ];
  for (const item of placements) {
    await page.getByRole('button', { name: 'Магазин', exact: true }).click();
    await page.locator('.room3d-catalog article').filter({ hasText: item.name }).getByRole('button', { name: 'Купить', exact: true }).click();
    await page.getByRole('button', { name: 'Закрыть панель' }).click();
    await page.getByRole('button', { name: 'Инвентарь', exact: true }).click();
    await page.locator('.room3d-catalog article').filter({ hasText: item.name }).getByRole('button', { name: 'Установить', exact: true }).click();
    for (let i = 0; i < Math.abs(item.x) * 2; i++) await page.getByRole('button', { name: item.x < 0 ? 'Сдвинуть влево' : 'Сдвинуть вправо' }).click();
    for (let i = 0; i < Math.abs(item.z) * 2; i++) await page.getByRole('button', { name: item.z < 0 ? 'Сдвинуть назад' : 'Сдвинуть вперёд' }).click();
    for (let i = 0; i < (item.turn ?? 0); i++) await page.getByRole('button', { name: 'Повернуть', exact: true }).click();
    await page.getByRole('button', { name: '✓ Установить', exact: true }).click();
  }
  await page.waitForTimeout(1500);
  const saved = JSON.parse(await page.evaluate(key => localStorage.getItem(key), saveKey));
  assert.equal(saved.rooms.driving.objects.length, 4);
  assert.equal(saved.coins, 2000 - 200 - 90 - 70 - 110);
  assert.equal(saved.rooms.sport?.objects.length ?? 0, 0, 'Комнаты не смешиваются');
  await page.screenshot({ path: 'room-preview/driving-furnished.png' });
  await page.getByRole('button', { name: 'Левый', exact: true }).click(); await page.waitForTimeout(1800);
  await page.screenshot({ path: 'room-preview/driving-left.png' });
  await setView(page, 'night', 'high');
  await page.screenshot({ path: 'room-preview/driving-night.png' });
  await page.reload();
  await enterRoom(page);
  const reloaded = JSON.parse(await page.evaluate(key => localStorage.getItem(key), saveKey));
  assert.deepEqual(reloaded.rooms.driving.objects, saved.rooms.driving.objects);
  await page.setViewportSize({ width: 390, height: 844 });
  await setView(page, 'day', 'medium');
  await page.screenshot({ path: 'room-preview/driving-mobile.png' });
  assert.deepEqual(errors, []);
  await writeFile('room-preview/driving-result.json', JSON.stringify({ passed: true, objects: saved.rooms.driving.objects, coins: saved.coins }, null, 2));
} catch (error) {
  await writeFile('room-preview/driving-error.txt', String(error.stack || error)); throw error;
} finally {
  await browser?.close();
  if (server.exitCode === null && server.signalCode === null) {
    const stopped = once(server, 'exit');
    server.kill('SIGTERM');
    await stopped;
  }
}
