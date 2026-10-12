/* global fetch, setTimeout, document */
// Снимок «Города» на экране телефона для проверки из облака: картинки и измерения уходят в аннотации Actions.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4190', '--strictPort'], { stdio: 'ignore' });
let browser;
const notice = (title, text) => console.log(`::notice title=${title}::${text}`);
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:4190')).ok) break; } catch { /* запуск */ } await new Promise(r => setTimeout(r, 500)); }
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  await page.goto('http://localhost:4190/?room-demo=sport');
  const map = page.locator('.coastal-map');
  await map.waitFor(); await map.scrollIntoViewIfNeeded();
  await page.locator('.live-city-canvas[data-ready="true"]').waitFor({ timeout: 30000 });
  await page.waitForTimeout(6000);
  const stats1 = JSON.parse(await page.locator('.live-city-canvas').getAttribute('data-stats'));
  const peds1 = stats1.positions.filter(p => p.kind === 'pedestrian');
  await page.waitForTimeout(3000);
  const stats2 = JSON.parse(await page.locator('.live-city-canvas').getAttribute('data-stats'));
  const peds2 = stats2.positions.filter(p => p.kind === 'pedestrian');
  const moved = peds2.filter(p => { const q = peds1.find(o => o.id === p.id); return q && Math.hypot((p.x - q.x) * 1005, (p.y - q.y) * 1280) > 2; }).length;
  notice('stats', JSON.stringify({ quality: stats2.quality, counts: stats2.counts, pedestriansMoved: moved, of: peds2.length, reduced: stats2.reduced, paused: stats2.paused }));
  // Сколько пикселей холста жителей непрозрачны (есть ли что-то нарисованное поверх карты).
  const ink = await page.evaluate(() => { const c = document.querySelector('.live-city-canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++; return { w: c.width, h: c.height, opaque: n }; });
  notice('canvas', JSON.stringify(ink));
  const box = await map.boundingBox();
  const shot = await page.screenshot({ type: 'jpeg', quality: 55, clip: { x: box.x, y: Math.max(0, box.y), width: box.width, height: Math.min(box.height, 520) } });
  notice('shot-map', shot.toString('base64'));
  // Крупно: площадь у «Здоровья» с маршрутом жителей, ×2.
  const big = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await big.goto('http://localhost:4190/?room-demo=sport');
  const bm = big.locator('.coastal-map'); await bm.waitFor(); await bm.scrollIntoViewIfNeeded();
  await big.locator('.live-city-canvas[data-ready="true"]').waitFor({ timeout: 30000 }); await big.waitForTimeout(7000);
  const b = await bm.boundingBox();
  const zoom = await big.screenshot({ type: 'jpeg', quality: 50, clip: { x: b.x + b.width * .3, y: b.y + b.height * .17, width: b.width * .45, height: b.height * .17 } });
  notice('shot-zoom', zoom.toString('base64'));
} catch (error) {
  notice('error', String(error.stack || error).replace(/\n/g, ' | ').slice(0, 2000)); process.exitCode = 1;
} finally {
  await browser?.close(); server.kill('SIGTERM');
}
