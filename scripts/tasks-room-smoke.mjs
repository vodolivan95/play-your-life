/* global fetch, setTimeout, localStorage */
// «Задачи»: вход из здания на карте, покупка и расстановка мебели, снимки ПК и телефона.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import process from 'node:process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const saveKey = 'play-your-life-3d-sport-demo-v1';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4181', '--strictPort'], { stdio: 'ignore' });
await mkdir('room-preview', { recursive: true });
let browser;
async function enterRoom(page) {
  const building = page.locator('[data-building="tasks"]');
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
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:4181')).ok) break; } catch { /* Vite ещё запускается. */ } await new Promise(resolve => setTimeout(resolve, 500)); }
  browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:4181/?room-demo=sport');
  await page.getByRole('heading', { name: 'Общая карта', exact: true }).waitFor();
  await enterRoom(page);
  assert.equal(await page.locator('section[aria-label="3D-комната Задачи"]').count(), 1);
  assert.equal(await page.locator('.room3d-unavailable').count(), 0, '3D сцена должна загрузиться');
  await setView(page, 'sunset', 'high');
  await page.screenshot({ path: 'room-preview/tasks-empty.png' });
  await page.getByRole('button', { name: 'Магазин', exact: true }).click();
  await page.screenshot({ path: 'room-preview/tasks-shop.png' });
  assert.equal(await page.locator('.room3d-catalog article').count(), 6);
  assert.equal(await page.locator('.room3d-catalog article').filter({ hasText: 'Витрина с наградами' }).getByRole('button').isDisabled(), true, 'Витрина открывается на 3 уровне');
  await page.getByRole('button', { name: 'Закрыть панель' }).click();
  const placements = [
    { name: 'Стол для работы стоя', x: 0, z: -3.5 }, { name: 'Мобильная канбан-доска', x: 3, z: 1.5 },
    { name: 'Песочные часы-помодоро', x: -2, z: -3.5 }, { name: 'Картотека', x: 4.5, z: -3.5 },
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
  assert.equal(saved.rooms.tasks.objects.length, 4);
  assert.equal(saved.coins, 2000 - 180 - 140 - 90 - 110);
  assert.equal(saved.rooms.sport?.objects.length ?? 0, 0, 'Комнаты не смешиваются');
  await page.screenshot({ path: 'room-preview/tasks-furnished.png' });
  await page.getByRole('button', { name: 'Левый', exact: true }).click(); await page.waitForTimeout(1800);
  await page.screenshot({ path: 'room-preview/tasks-left.png' });
  await setView(page, 'night', 'high');
  await page.screenshot({ path: 'room-preview/tasks-night.png' });
  await page.reload();
  await enterRoom(page);
  const reloaded = JSON.parse(await page.evaluate(key => localStorage.getItem(key), saveKey));
  assert.deepEqual(reloaded.rooms.tasks.objects, saved.rooms.tasks.objects);
  await page.setViewportSize({ width: 390, height: 844 });
  await setView(page, 'day', 'medium');
  await page.screenshot({ path: 'room-preview/tasks-mobile.png' });
  assert.deepEqual(errors, []);
  await writeFile('room-preview/tasks-result.json', JSON.stringify({ passed: true, objects: saved.rooms.tasks.objects, coins: saved.coins }, null, 2));
} catch (error) {
  await writeFile('room-preview/tasks-error.txt', String(error.stack || error)); throw error;
} finally {
  await browser?.close();
  if (server.exitCode === null && server.signalCode === null) {
    const stopped = once(server, 'exit');
    server.kill('SIGTERM');
    await stopped;
  }
}
