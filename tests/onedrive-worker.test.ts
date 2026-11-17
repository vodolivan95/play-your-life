import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfidentialClientApplication, TokenCache } from '@azure/msal-node';
import worker, { OneDriveAccount } from '../integrations/onedrive/worker.ts';
import type { Env, Storage } from '../integrations/onedrive/worker.ts';
import { graphPath, seal, unseal, uploadUrl } from '../integrations/onedrive/security.ts';

test('encrypted cache is authenticated, randomized and bound to account; proxy rejects foreign URLs', async () => {
  const key = 'f'.repeat(64), value = { refreshToken: 'fixture-secret' };
  const encrypted = await seal(value, key, 'account-a');
  assert.equal(encrypted.includes('fixture-secret'), false);
  assert.notEqual(encrypted, await seal(value, key, 'account-a'));
  assert.deepEqual(await unseal(encrypted, key, 'account-a'), value);
  await assert.rejects(() => unseal(encrypted, key, 'account-b'));
  await assert.rejects(() => unseal(encrypted, 'a'.repeat(64), 'account-a'));
  for (const path of ['https://attacker.example/v1.0/me/drive', 'https://graph.microsoft.com.attacker.example/v1.0/me/drive', 'https://graph.microsoft.com/v1.0/users/other/drive', 'https://user:password@graph.microsoft.com/v1.0/me/drive', '/me/drive/../../users/other/drive', '/me/drive/items/a%2fb']) assert.throws(() => graphPath(path));
  assert.equal(graphPath('/me/drive/root/children?$top=100'), 'https://graph.microsoft.com/v1.0/me/drive/root/children?$top=100');
  assert.throws(() => uploadUrl('https://up.1drv.com.attacker.example/upload'));
  assert.throws(() => uploadUrl('http://fixture.up.1drv.com/upload'));
});

test('Firebase isolation, one-use PKCE callback, encrypted sessions, Graph and upload authorization', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const kid = crypto.randomUUID(), jwk = { ...await crypto.subtle.exportKey('jwk', pair.publicKey), kid };
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const jwt = async (uid: string, patch: Record<string, unknown> = {}) => {
    const now = Math.floor(Date.now() / 1000);
    const text = `${b64({ alg: 'RS256', kid })}.${b64({ sub: uid, aud: 'fixture-project', iss: 'https://securetoken.google.com/fixture-project', iat: now, auth_time: now, exp: now + 3600, ...patch })}`;
    return `${text}.${Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(text))).toString('base64url')}`;
  };
  // SDK boundaries are mocked; Firebase signature verification, routing, encryption, PKCE generation and HTTP logic are real.
  let verifier = '', exchanges = 0, silent = 0;
  t.mock.method(ConfidentialClientApplication.prototype, 'getAuthCodeUrl', async (data: Record<string, string>) => {
    assert.equal(data.codeChallengeMethod, 'S256'); assert.ok(data.codeChallenge.length > 40);
    return `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?${new URLSearchParams({ state: data.state, code_challenge: data.codeChallenge })}`;
  });
  t.mock.method(ConfidentialClientApplication.prototype, 'acquireTokenByCode', async (data: { codeVerifier: string; code: string }) => {
    exchanges++; verifier = data.codeVerifier;
    return { account: { homeAccountId: data.code, username: `${data.code}@example.test` } };
  });
  t.mock.method(TokenCache.prototype, 'serialize', () => 'fixture-provider-refresh-secret');
  t.mock.method(TokenCache.prototype, 'deserialize', () => {});
  t.mock.method(TokenCache.prototype, 'getAccountByHomeId', async (id: string) => ({ homeAccountId: id }));
  t.mock.method(ConfidentialClientApplication.prototype, 'acquireTokenSilent', async (data: { account: { homeAccountId: string } }) => { silent++; return { accessToken: `provider-${data.account.homeAccountId}` }; });
  const objects = new Map<string, OneDriveAccount>(), stores = new Map<string, Map<string, unknown>>(), names = new Map<string, string>();
  const env: Env = {
    APP_URL: 'https://app.example/life/', BRIDGE_URL: 'https://bridge.example', FIREBASE_PROJECT_ID: 'fixture-project',
    MICROSOFT_CLIENT_ID: 'fixture-client', MICROSOFT_CLIENT_SECRET: 'fixture-secret', TOKEN_ENCRYPTION_KEY: 'e'.repeat(64),
    ACCOUNTS: {
      idFromName: name => { if (!names.has(name)) names.set(name, String(names.size + 1).padStart(64, '0')); return { toString: () => names.get(name)! }; },
      idFromString: id => ({ toString: () => id }),
      get: id => {
        const owner = id.toString();
        if (!objects.has(owner)) {
          const entries = new Map<string, unknown>(); stores.set(owner, entries);
          const storage: Storage = { get: async <T>(key: string) => entries.get(key) as T | undefined, put: async (key, value) => { entries.set(key, structuredClone(value)); }, delete: async key => entries.delete(key), deleteAll: async () => { entries.clear(); } };
          objects.set(owner, new OneDriveAccount({ storage, id }, env));
        }
        return { fetch: request => objects.get(owner)!.fetch(request) };
      },
    },
  };
  let graphCalls = 0, uploadCalls = 0, throttled = false;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('https://www.googleapis.com/')) return Response.json({ keys: [jwk] });
    if (url.startsWith('https://graph.microsoft.com/')) {
      graphCalls++;
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer provider-user-a');
      if (throttled) return Response.json({ error: { message: 'RAW SECRET ERROR' } }, { status: 429, headers: { 'Retry-After': '20' } });
      if (init?.method === 'PATCH') {
        assert.equal(new Headers(init.headers).get('If-Match'), '"version-1"');
        return Response.json({ error: { message: 'Internal conflict details' } }, { status: 412 });
      }
      if (url.endsWith('/createUploadSession')) return Response.json({ uploadUrl: 'https://fixture.up.1drv.com/upload?secret=fixture', expirationDateTime: new Date(Date.now() + 600000).toISOString() });
      if (url.endsWith('/content')) return new Response(null, { status: 302, headers: { Location: 'https://fixture.files.1drv.com/content?secret=fixture' } });
      return Response.json({ value: [{ id: 'private-file', name: 'Private.txt', '@microsoft.graph.downloadUrl': 'secret-url' }] });
    }
    if (url.startsWith('https://fixture.up.1drv.com/')) {
      uploadCalls++; assert.equal(new Headers(init?.headers).has('Authorization'), false);
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      if (init?.method === 'PUT') return Response.json({ id: 'finished', name: 'uploaded.bin' }, { status: 201 });
      return Response.json({ nextExpectedRanges: ['0-'] });
    }
    if (url.startsWith('https://fixture.files.1drv.com/')) { assert.equal(new Headers(init?.headers).has('Authorization'), false); return new Response('fixture content'); }
    throw new Error('Unexpected upstream');
  };
  const a = await jwt('user-a'), b = await jwt('user-b');
  const call = (token: string, path: string, method = 'GET', body?: BodyInit, extra: HeadersInit = {}) => worker.fetch(new Request(`https://bridge.example${path}`, {
    method, headers: { Origin: 'https://app.example', Authorization: `Bearer ${token}`, 'X-User-Id': 'user-a', ...Object.fromEntries(new Headers(extra)) }, body,
  }), env);
  for (const token of ['', await jwt('user-a', { exp: 0 }), await jwt('user-a', { aud: 'wrong' }), a.slice(0, -8) + 'invalid']) assert.equal((await call(token, '/status')).status, 401);
  assert.equal(objects.size, 0);
  assert.equal((await worker.fetch(new Request('https://bridge.example/status', { headers: { Origin: 'https://attacker.example' } }), env)).status, 403);
  assert.equal((await call(a, '/status', 'OPTIONS')).status, 204);
  const start = await worker.fetch(new Request('https://bridge.example/authorize', { method: 'POST', headers: { Origin: 'https://app.example', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ credential: a }) }), env);
  assert.equal(start.status, 303, 'top-level login works without third-party cookies');
  assert.equal(start.headers.get('Location')!.includes(a), false, 'Firebase credential is never in a URL');
  const target = new URL(start.headers.get('Location')!), state = target.searchParams.get('state')!;
  const csrf = start.headers.get('Set-Cookie')!.split(';')[0];
  assert.match(start.headers.get('Set-Cookie')!, /HttpOnly; Secure; SameSite=Lax/);
  const callback = (s = state, cookie = csrf) => worker.fetch(new Request(`https://bridge.example/callback?state=${s}&code=user-a`, { headers: { Cookie: cookie } }), env);
  assert.equal((await callback(state, '')).status, 400, 'login CSRF rejected');
  assert.equal((await callback(state.slice(0, -1) + 'f')).status, 400);
  const completed = await callback(); assert.equal(completed.status, 303); assert.equal(exchanges, 1);
  assert.equal(completed.headers.get('Location'), 'https://app.example/life/#/drive');
  const challenge = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))).toString('base64url');
  assert.equal(challenge, target.searchParams.get('code_challenge'));
  assert.equal((await callback()).status, 400, 'state cannot be replayed');
  assert.deepEqual(await (await call(b, '/status?uid=user-a')).json(), { connected: false });
  assert.deepEqual(await (await call(a, '/status')).json(), { connected: true, username: 'user-a@example.test' });
  assert.deepEqual(await (await call(await jwt('user-a'), '/status')).json(), { connected: true, username: 'user-a@example.test' }, 'another device uses same verified UID');
  const entries = stores.get(names.get('user-a')!)!;
  assert.equal(JSON.stringify([...entries]).includes('refresh-secret'), false);
  const result = await call(a, `/graph?path=${encodeURIComponent('/me/drive/root/children')}`);
  assert.equal((await result.text()).includes('secret-url'), false);
  assert.equal((await call(b, `/graph?uid=user-a&path=${encodeURIComponent('/me/drive/root/children')}`)).status, 401);
  const before = graphCalls;
  assert.equal((await call(a, `/graph?path=${encodeURIComponent('https://attacker.example/leak')}`)).status, 400);
  assert.equal(graphCalls, before);
  const conflict = await call(a, `/graph?path=${encodeURIComponent('/me/drive/items/file')}`, 'PATCH', JSON.stringify({ name: 'changed' }), { 'If-Match': '"version-1"' });
  assert.equal(conflict.status, 412); assert.match(await conflict.text(), /другом устройстве/);
  const content = await call(a, `/graph?path=${encodeURIComponent('/me/drive/items/file/content')}`);
  assert.equal(await content.text(), 'fixture content');
  const upload = await call(a, '/uploads', 'POST', JSON.stringify({ path: '/me/drive/root:/file.bin:/createUploadSession', size: 3 }));
  const handle = (await upload.json() as { id: string }).id; assert.match(handle, /^[a-f0-9]{64}$/);
  assert.equal((await call(b, `/uploads/${handle}`)).status, 410);
  assert.equal(uploadCalls, 0, 'foreign handle never reaches provider');
  assert.equal((await call(a, `/uploads/${handle}`, 'PUT', 'abc', { 'Content-Range': 'bytes 0-2/4' })).status, 400);
  assert.equal((await call(a, `/uploads/${handle}`, 'PUT', 'abc', { 'Content-Range': 'bytes 0-2/3' })).status, 201);
  assert.equal((await call(a, `/uploads/${handle}`)).status, 410, 'completed handle discarded');
  throttled = true;
  const limited = await call(a, `/graph?path=${encodeURIComponent('/me/drive/root/children')}`, 'POST', JSON.stringify({ name: 'folder', folder: {} }));
  assert.equal(limited.status, 429); assert.equal(limited.headers.get('Retry-After'), '20'); assert.equal((await limited.text()).includes('RAW SECRET'), false);
  const callsBeforeDisconnect = graphCalls;
  await call(a, '/disconnect', 'POST'); assert.equal(entries.size, 0);
  assert.equal(graphCalls, callsBeforeDisconnect, 'disconnect never deletes provider files');
  assert.equal((await call(a, `/graph?path=${encodeURIComponent('/me/drive/root/children')}`)).status, 401);
  assert.ok(silent > 2, 'MSAL silent acquisition is used for every protected provider operation');
});
