import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GraphError, mergeDriveItems, OneDriveClient, retryDelay, sortDriveItems } from '../src/oneDrive.ts';
import { validDriveLink } from '../src/oneDriveLinks.ts';
import { validTaskDetails } from '../src/taskDetails.ts';
import { validProjectMaterials } from '../src/projectMaterials.ts';

test('OneDrive references survive validation without credentials, bytes or permission grants', () => {
  const link = { driveId: 'drive-1', itemId: 'item-2', name: 'План.pdf', folder: false };
  assert.equal(validDriveLink(link), true);
  for (const bad of [{ ...link, token: 'credential' }, { ...link, itemId: '../other' }, { ...link, driveId: '' }, { ...link, folder: 'yes' }]) assert.equal(validDriveLink(bad), false);
  const attachment = { id: 'ref-1', name: link.name, type: 'link', url: 'https://app.example/#/drive', oneDrive: link };
  assert.equal(validTaskDetails({ attachments: [attachment] }), true);
  assert.equal(validTaskDetails({ attachments: [{ ...attachment, oneDrive: { ...link, folder: true } }] }), false);
  assert.equal(validProjectMaterials([{ id: 'm1', title: link.name, kind: 'onedrive', oneDrive: link, updatedAt: '2026-11-17', starred: true }]), true);
  assert.equal(validProjectMaterials([{ id: 'm1', title: link.name, kind: 'onedrive', oneDrive: { ...link, token: 'secret' }, updatedAt: '2026-11-17', starred: true }]), false);
  assert.equal(validProjectMaterials(undefined), true, 'old saves stay compatible');
});

test('sorting is stable with folders first; delta removes deleted metadata and replaces duplicates', () => {
  const items = [{ id: 'a', name: 'file10', size: 10 }, { id: 'b', name: 'file2', size: 2 }, { id: 'f', name: 'folder', folder: {}, size: 0 }];
  assert.deepEqual(sortDriveItems(items, 'name', false).map(x => x.id), ['f', 'b', 'a']);
  assert.deepEqual(sortDriveItems(items, 'size', true).map(x => x.id), ['f', 'a', 'b']);
  assert.deepEqual(mergeDriveItems(items, [{ id: 'a', name: 'deleted', deleted: {} }, { id: 'b', name: 'renamed' }]).map(x => x.name), ['renamed', 'folder']);
  assert.equal(items[0].name, 'file10');
  assert.equal(retryDelay('20', 0), 20000);
  assert.equal(retryDelay(null, 1), 2000);
});

test('client sends only fresh Firebase credentials to configured bridge and never replays mutations', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  let calls = 0, tokens = 0;
  const client = new OneDriveClient(async () => `firebase-${++tokens}`, 'https://bridge.example');
  globalThis.fetch = async (url, init) => {
    calls++; assert.ok(String(url).startsWith('https://bridge.example/'));
    assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer firebase-${tokens}`);
    assert.equal(init?.credentials, 'omit');
    return Response.json({ error: 'Лимит запросов' }, { status: 429, headers: { 'Retry-After': '60' } });
  };
  await assert.rejects(() => client.createFolder(undefined, 'Папка'), (e: unknown) => e instanceof GraphError && e.status === 429);
  assert.equal(calls, 1);
  await assert.rejects(() => client.status(), /Лимит/); assert.equal(calls, 2, 'long Retry-After is not shortened');
  await assert.rejects(() => new OneDriveClient(async () => 'never-send', 'http://attacker.example').status(), /HTTPS/);
  assert.equal(calls, 2);
});

test('upload resumes at Microsoft offset after interruption; no overwrite or false completion', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  const client = new OneDriveClient(async () => 'firebase', 'https://bridge.example');
  const file = new File([new Uint8Array(6 * 1024 * 1024)], 'big.bin', { lastModified: 1 });
  let creates = 0, offset = 0, fail = true;
  const ranges: string[] = [], progress: number[] = [];
  globalThis.fetch = async (url, init) => {
    const path = new URL(String(url)).pathname;
    if (path === '/uploads') { creates++; return Response.json({ id: 'handle' }); }
    if (!init?.method) return Response.json({ nextExpectedRanges: [`${offset}-`] });
    if (init.method === 'PUT') {
      const range = new Headers(init.headers).get('Content-Range')!; ranges.push(range);
      if (range.startsWith('bytes 0-')) { offset = 5 * 1024 * 1024; return Response.json({ nextExpectedRanges: [`${offset}-`] }, { status: 202 }); }
      if (fail) { fail = false; throw new TypeError('fixture offline'); }
      return Response.json({ id: 'completed', name: file.name }, { status: 201 });
    }
    throw new Error('unexpected upload operation');
  };
  await assert.rejects(() => client.upload(undefined, file, p => progress.push(p)));
  assert.equal(progress.includes(100), false);
  await client.upload(undefined, file, p => progress.push(p));
  assert.equal(creates, 1); assert.equal(ranges.length, 3);
  assert.equal(ranges[1], ranges[2]); assert.equal(progress.at(-1), 100);
});

test('cancellation removes upload handle without announcing success', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  const client = new OneDriveClient(async () => 'firebase', 'https://bridge.example');
  const controller = new AbortController(); let cancelled = false;
  globalThis.fetch = async (url, init) => {
    if (new URL(String(url)).pathname === '/uploads') return Response.json({ id: 'handle' });
    if (!init?.method) return Response.json({ nextExpectedRanges: ['0-'] });
    if (init.method === 'PUT') { controller.abort(); throw controller.signal.reason; }
    if (init.method === 'DELETE') { cancelled = true; return Response.json({ cancelled: true }); }
    throw new Error('unexpected');
  };
  const progress: number[] = [];
  await assert.rejects(() => client.upload(undefined, new File(['file'], 'x.txt'), p => progress.push(p), controller.signal));
  assert.equal(cancelled, true); assert.equal(progress.includes(100), false);
});
