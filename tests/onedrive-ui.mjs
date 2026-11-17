import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

// Isolated service fixtures only. No Microsoft account, real credential or user data.
const dir = 'work/onedrive', origin = 'http://127.0.0.1:5186', bridge = 'https://onedrive-bridge.example';
await mkdir(dir, { recursive: true });
await writeFile(`${dir}/harness.html`, '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/work/onedrive/harness.tsx"></script></body></html>');
await writeFile(`${dir}/harness.tsx`, `import React from 'react'; import {createRoot} from 'react-dom/client'; import OneDrivePage from '../../src/components/OneDrivePage'; import '../../src/styles.css'; import '../../src/interface.css';
const uid = new URLSearchParams(location.search).get('uid') || 'alice';
document.documentElement.dataset.theme = new URLSearchParams(location.search).get('theme') || 'light';
createRoot(document.getElementById('root')!).render(<OneDrivePage uid={uid} getToken={async ()=>'fixture-'+uid}/>);`);
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5186', '--strictPort'], { env: { ...process.env, VITE_BASE_PATH: '/', VITE_ONEDRIVE_BRIDGE_URL: bridge }, stdio: ['ignore', 'pipe', 'pipe'] });
let output = ''; server.stdout.on('data', x => { output += x; }); server.stderr.on('data', x => { output += x; });
const errors = [], calls = []; let browser, activePage;
async function tools(page, open) { const toggle = page.getByRole('button', {name:'Инструменты',exact:true}); if ((await toggle.getAttribute('aria-expanded')) !== String(open)) await toggle.click(); }
function item(id, name, folder = false, size = 20) {
  return { id, name, size, ...(folder ? { folder: { childCount: 1 } } : { file: { mimeType: name.endsWith('.png') ? 'image/png' : name.endsWith('.pdf') ? 'application/pdf' : 'text/plain' } }), parentReference: { id: 'root', driveId: 'drive-alice' }, webUrl: 'https://onedrive.live.com/', lastModifiedDateTime: '2026-11-17T08:00:00Z' };
}
try {
  for (let attempt = 0; attempt < 100; attempt++) { try { if ((await fetch(`${origin}/work/onedrive/harness.html`)).ok) break; } catch { /* startup */ } await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ executablePath: process.env.LIFEGAME_CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const width of [1440, 768, 390, 320]) {
    const ctx = await browser.newContext({ viewport: { width, height: 960 }, isMobile: width < 600, hasTouch: width < 600 });
    const files = [item('docs', 'Документы', true), item('archive', '01. АРХИВ', true), item('work', '03. РАБОТА', true), item('study', '04. ОБУЧЕНИЕ', true), item('note', 'План.md'), item('pdf', 'Обзор.pdf', false, 900), ...Array.from({ length: 94 }, (_, i) => item(`file-${i}`, `Файл ${i}.txt`, false, i + 1))];
    const extras = [item('more-1', 'Продолжение 1.txt'), item('more-2', 'Продолжение 2.txt')];
    let connected = true, noAccess = false, unsupportedSearch = false, deletions = 0;
    await ctx.route(`${bridge}/**`, async route => {
      const req = route.request(), url = new URL(req.url()), method = req.method();
      const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Authorization, Content-Type, Content-Range', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, PUT, OPTIONS' };
      const send = (data, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(data) });
      if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
      const uid = req.headers().authorization?.replace('Bearer fixture-', '');
      calls.push({ uid, path: url.pathname, method });
      if (url.pathname === '/status') return send({ connected: uid === 'alice' && connected, username: 'alice@example.test' });
      if (url.pathname === '/disconnect') { connected = false; return send({ connected: false }); }
      if (!connected || uid !== 'alice') return send({ error: 'Подключите OneDrive.' }, 401);
      if (url.pathname === '/uploads') return send({ id: 'test-upload' });
      if (url.pathname === '/uploads/test-upload') return method === 'GET' ? send({ nextExpectedRanges: ['0-'] }) : send(item('new-upload', 'upload.txt'), 201);
      const path = decodeURIComponent(url.searchParams.get('path') || '');
      if (noAccess) return send({ error: 'Нет доступа к файлу или папке.' }, 403);
      if (path === '/me/drive') return send({ id: 'drive-alice', quota: { used: 1024, total: 10240 } });
      if (path.includes('/delta?')) return send({ value: [], '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/drive/root/delta?token=fixture' });
      if (path.endsWith('/thumbnails/0/medium/content')) return send({ error: 'Нет миниатюры' }, 404);
      if (path.endsWith('/content')) return route.fulfill({ status: 200, headers, contentType: 'application/octet-stream', body: '# План\n<script>window.fixtureXss=true</script>\nТекст OneDrive' });
      if (path.includes('/search(')) {
        if (unsupportedSearch) return send({ error: 'Операция не поддерживается' }, 501);
        return send({ value: files.filter(f => f.name.includes('План')) });
      }
      if (method === 'POST' && path.includes('/children')) { const data = req.postDataJSON(); files.push(item('created-folder', data.name, true)); return send(files.at(-1), 201); }
      if (method === 'DELETE') { const id = path.split('/').at(-1); const at = files.findIndex(f => f.id === id); if (at >= 0) files.splice(at, 1); deletions++; return route.fulfill({ status: 204, headers }); }
      if (method === 'PATCH') { const id = path.split('/').at(-1); const target = files.find(f => f.id === id); const data = req.postDataJSON(); if (target && data.name) target.name = data.name; return send(target || {}); }
      if (path.includes('/items/docs/children')) return send({ value: [item('nested', 'Вложенный.txt')] });
      if (path === '/me/drive/items/docs') return send(files[0]);
      if (path === '/me/drive/items/root' || path === '/me/drive/root') return send({ id: 'root', name: 'OneDrive', folder: {} });
      if (path.includes('$skiptoken=page2')) return send({ value: extras });
      if (path.includes('/children')) return send({ value: files, '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/drive/root/children?$skiptoken=page2' });
      return send({ error: 'Неизвестный тестовый маршрут' }, 404);
    });
    await ctx.addInitScript(() => { for (const [id,color] of [['docs','blue'],['work','blue'],['study','teal']]) localStorage.setItem('pyl:drive-color:alice:drive-alice:'+id,color); });
    const page = await ctx.newPage(); activePage = page; page.on('pageerror', e => errors.push(String(e)));
    const home = `${origin}/work/onedrive/harness.html?uid=alice&theme=${width < 600 ? 'dark' : 'light'}#/drive`;
    await page.goto(home); await page.getByRole('button', { name: 'Документы', exact: false }).filter({ has: page.locator('.od-folder') }).waitFor();
    assert.equal(await page.locator('.od-item').count(), 100);
    if (width < 640) await tools(page, true);
    await page.getByRole('button', { name: 'Показать ещё', exact: true }).click(); await page.locator('.od-item').filter({ hasText: 'Продолжение 2.txt' }).waitFor();
    assert.equal(await page.locator('.od-item').count(), 102, 'large directories are paged');
    await page.getByLabel('Сортировка', { exact: true }).selectOption('size'); await page.getByRole('button', { name: 'Изменить направление сортировки' }).click();
    assert.match(await page.locator('.od-item:not(:has(.od-folder)) .od-open').first().innerText(), /Обзор.pdf/);
    await page.getByRole('button', { name: 'Документы', exact: false }).filter({ has: page.locator('.od-folder') }).click();
    await page.locator('.od-open[title="Вложенный.txt"]').waitFor();
    await page.getByRole('navigation', { name: 'Расположение' }).getByRole('button', { name: 'Мой диск', exact: true }).click();
    await page.locator('.od-open[title="План.md"]').waitFor();
    await page.locator('.od-open[title="План.md"]').click();
    const preview = page.getByRole('dialog', { name: 'План.md', exact: true }); await preview.locator('pre').waitFor();
    assert.match(await preview.locator('pre').innerText(), /<script>/); assert.equal(await page.evaluate(() => window.fixtureXss), undefined);
    await preview.getByRole('button', { name: 'Закрыть', exact: true }).click();
    await page.getByRole('button', { name: '＋ Папка', exact: true }).click(); const form = page.getByRole('dialog', { name: 'Новая папка' });
    await form.getByLabel('Название').fill('Новая папка'); await form.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await page.getByRole('button', { name: 'Новая папка', exact: false }).filter({ has: page.locator('.od-folder') }).waitFor();
    await page.getByLabel('Выбрать План.md', { exact: true }).check(); await page.getByLabel('Выбрать Файл 0.txt', { exact: true }).check();
    await page.getByRole('button', { name: 'Переместить', exact: true }).click();
    const picker = page.getByRole('dialog', { name: 'Выберите папку OneDrive' }); await picker.getByRole('button', { name: '📁 Документы', exact: true }).click(); await picker.getByRole('button', { name: 'Выбрать эту папку' }).click();
    await page.getByText('Готово', { exact: true }).waitFor();
    await page.getByLabel('Выбрать План.md', { exact: true }).check(); await page.getByLabel('Выбрать Файл 0.txt', { exact: true }).check();
    page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Удалить выбранные' }).click(); await page.getByText('Удалено: 2', { exact: true }).waitFor(); assert.equal(deletions, 2);
    await page.locator('input[type=file]').setInputFiles({ name: 'upload.txt', mimeType: 'text/plain', buffer: Buffer.from('fixture') }); await page.getByText('Загружено файлов: 1', { exact: true }).waitFor();
    unsupportedSearch = true;
    await page.getByRole('textbox', { name: 'Поиск в моём диске' }).fill('Файл 1'); await page.getByText('Поиск Microsoft недоступен.', { exact: false }).waitFor();
    assert.ok(await page.locator('.od-item').count() >= 1);
    await page.getByRole('button', { name: 'Очистить поиск' }).click(); await page.getByRole('button', { name: 'Документы', exact: false }).filter({ has: page.locator('.od-folder') }).waitFor();
    await page.getByRole('button', { name: 'Список', exact: true }).click();
    await page.getByRole('button', { name: 'Плитка', exact: true }).click();
    if (width < 600) {
      const boxes = await page.locator('.od-grid .od-item:has(.od-folder)').evaluateAll(nodes => nodes.slice(0,3).map(n => ({x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y})));
      assert.ok(Math.abs(boxes[0].y-boxes[1].y)<2 && boxes[1].x>boxes[0].x && boxes[2].y>boxes[0].y, 'two large folders per mobile row');
      const tile = page.locator('.od-grid .od-item:has(.od-folder)').first();
      assert.ok((await tile.locator('.od-item-controls').boundingBox()).y > (await tile.locator('small').boundingBox()).y, 'folder menu sits under the date');
    }
    if (width < 640) await tools(page, false);
    await page.mouse.move(0,0);
    await page.evaluate(() => scrollTo(0,0));
    await page.screenshot({ path: `${dir}/${width}.png`, fullPage: false });
    if (width === 390) { await page.evaluate(() => document.documentElement.dataset.theme='light'); await page.screenshot({ path: `${dir}/390-light.png`, fullPage:false }); await page.evaluate(() => document.documentElement.dataset.theme='dark'); }
    if (width < 640) await tools(page, true);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}px: no horizontal overflow`);
    await ctx.setOffline(true); await page.getByText('Нет подключения к интернету.', { exact: false }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Загрузить файлы', exact: true }).isDisabled(), true);
    await ctx.setOffline(false); await page.getByRole('button', { name: 'Загрузить файлы', exact: true }).waitFor({ state: 'visible' });
    if (width < 640) await tools(page, true);
    noAccess = true; await page.getByRole('button', { name: 'Обновить', exact: true }).click(); await page.getByRole('alert').getByText('Нет доступа', { exact: false }).waitFor();
    noAccess = false; await page.getByRole('button', { name: 'Повторить чтение', exact: true }).click(); await page.getByRole('button', { name: 'Документы', exact: false }).filter({ has: page.locator('.od-folder') }).waitFor();
    await page.getByRole('button', { name: 'Отключить OneDrive', exact: true }).click(); await page.getByRole('button', { name: 'Подключить OneDrive', exact: true }).waitFor();
    const other = await ctx.newPage(); await other.goto(`${origin}/work/onedrive/harness.html?uid=bob#/drive`); await other.getByRole('button', { name: 'Подключить OneDrive', exact: true }).waitFor(); assert.equal(await other.locator('.od-item').count(), 0);
    await ctx.close();
  }
  assert.deepEqual(errors, []);
  assert.ok(calls.some(call => call.uid === 'bob'));
  process.stdout.write('OneDrive fixture UI: 1440/768/390/320, paging, preview, folders, move/delete, upload, offline, errors and second user passed.\n');
} catch (e) { if (activePage && !activePage.isClosed()) { await activePage.screenshot({path:`${dir}/failure.png`}).catch(()=>{}); await writeFile(`${dir}/failure.html`, await activePage.content().catch(()=>'')); } process.stderr.write(output); throw e; }
finally { await browser?.close(); server.kill('SIGTERM'); }
