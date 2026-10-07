import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

await mkdir('work', { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5175', '--strictPort']);
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch('http://127.0.0.1:5175/')).ok) break; } catch { /* Server starting. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ executablePath: process.env.LIFEGAME_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  for (const width of [320, 390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:5175/');
    await page.locator('.account-brand img').waitFor();
    assert.equal(await page.title(), 'PLAY YOUR LIFE');
    assert.equal(await page.locator('meta[name="description"]').getAttribute('content'), 'PLAY YOUR LIFE — игровая система развития жизни, целей, привычек и достижений.');
    assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'), '#edf8ff');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const logo = await page.locator('.account-brand img').evaluate(img => ({ loaded: img.complete && img.naturalWidth === 96, fit: getComputedStyle(img).objectFit, square: img.clientWidth === img.clientHeight }));
    assert.deepEqual(logo, { loaded: true, fit: 'contain', square: true });
    for (const [selector, size] of [['link[rel="icon"][sizes="16x16"]',16], ['link[rel="icon"][sizes="32x32"]',32], ['link[rel="apple-touch-icon"]',180]]) {
      const href = await page.locator(selector).getAttribute('href');
      assert.equal(await page.evaluate(async ({href,size}) => { const img = new Image(); img.src = href; await img.decode(); return img.naturalWidth === size && img.naturalHeight === size; }, {href,size}), true);
    }
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifest = await (await page.request.get(new URL(manifestHref, page.url()).href)).json();
    assert.equal(manifest.name, 'PLAY YOUR LIFE');
    assert.equal(manifest.short_name, 'PLAY YOUR LIFE');
    assert.equal(manifest.display, 'standalone');
    for (const icon of manifest.icons) {
      const url = new URL(icon.src, new URL(manifestHref, page.url())).href;
      const [size] = icon.sizes.split('x').map(Number);
      assert.equal(await page.evaluate(async ({url,size}) => { const img = new Image(); img.src = url; await img.decode(); return img.naturalWidth === size && img.naturalHeight === size; }, {url,size}), true);
    }
    await page.getByRole('button', { name: 'Регистрация', exact: true }).click();
    assert.equal(await page.locator('.account-brand').isVisible(), true);
    await page.getByRole('button', { name: 'Забыли пароль?' }).click();
    assert.equal(await page.locator('.account-brand').isVisible(), true);
    await page.reload();
    await page.locator('.account-brand').waitFor();
    await page.screenshot({ path: `work/logo-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Продолжить игру на этом устройстве' }).click();
    await page.locator('.app-shell').waitFor();
    await page.goto('http://127.0.0.1:5175/#city');
    await page.reload();
    await page.getByRole('button', { name: 'Продолжить игру на этом устройстве' }).click();
    await page.locator('.app-shell').waitFor();
    assert.deepEqual(errors, []);
    console.log(`${width}px: login, registration, reset, icons, manifest, guest and hash-route reload OK`);
    await page.close();
  }
} finally {
  await browser?.close();
  server.kill();
}
