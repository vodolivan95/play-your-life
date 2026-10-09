import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { TickTickAccount } from '../integrations/ticktick/worker.ts';
import type { Env, Storage } from '../integrations/ticktick/worker.ts';
import { emptyTickTickSettings, validateTickTickSettings } from '../src/ticktickSettings.ts';
import { bridgeRequest, newConnection } from '../src/ticktick.ts';

test('Firebase-подключения изолированы по проверенному UID и доступны с другого устройства', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const kid = crypto.randomUUID();
  const jwk = { ...await crypto.subtle.exportKey('jwk', pair.publicKey), kid };
  const base64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const jwt = async (uid: string, patch: Record<string, unknown> = {}, algorithm = 'RS256', signingKid = kid) => {
    const now = Math.floor(Date.now() / 1000);
    const data = `${base64({ alg: algorithm, kid: signingKid })}.${base64({ sub: uid, aud: 'test-firebase', iss: 'https://securetoken.google.com/test-firebase', iat: now, auth_time: now, exp: now + 3600, ...patch })}`;
    return `${data}.${Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(data))).toString('base64url')}`;
  };
  let keyReads = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('https://www.googleapis.com/service_accounts/')) { keyReads++; return Response.json({ keys: [jwk] }); }
    if (url === 'https://ticktick.com/oauth/token') {
      const code = new URLSearchParams(String(init?.body)).get('code');
      return Response.json({ access_token: `provider-${code}`, expires_in: 3600 });
    }
    if (url === 'https://api.ticktick.com/open/v1/project') return Response.json([{ id: 'own-list', name: 'Мои тренировки' }]);
    throw new Error('Unexpected upstream request');
  };
  const identities = new Map<string, string>();
  const stores = new Map<string, Map<string, unknown>>();
  const accounts = new Map<string, TickTickAccount>();
  const env: Env = {
    APP_URL: 'https://app.example/play-your-life/', FIREBASE_PROJECT_ID: 'test-firebase',
    TICKTICK_CLIENT_ID: 'fixture-client', TICKTICK_CLIENT_SECRET: 'fixture-secret',
    ACCOUNTS: {
      idFromName: name => {
        if (!identities.has(name)) identities.set(name, (identities.size + 1).toString(16).padStart(64, '0'));
        return { toString: () => identities.get(name)! };
      },
      idFromString: id => ({ toString: () => id }),
      get: id => {
        const key = id.toString();
        if (!accounts.has(key)) {
          const entries = new Map<string, unknown>(); stores.set(key, entries);
          const storage: Storage = { get: async <T>(k: string) => entries.get(k) as T | undefined, put: async (k, v) => { entries.set(k, structuredClone(v)); }, delete: async k => entries.delete(k) };
          accounts.set(key, new TickTickAccount({ storage }, env));
        }
        return { fetch: request => accounts.get(key)!.fetch(request) };
      },
    },
  };
  const tokenA = await jwt('user-a'), tokenB = await jwt('user-b');
  const call = (token: string, path: string, method = 'GET', data?: unknown) => worker.fetch(new Request(`https://bridge.example${path}`, {
    method, headers: { Origin: 'https://app.example', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Account-Id': 'spoofed-user-b' },
    body: data === undefined ? undefined : JSON.stringify(data),
  }), env);
  for (const token of [await jwt('user-a', { exp: 0 }), await jwt('user-a', { aud: 'foreign' }), await jwt('user-a', { iss: 'https://attacker.example' }), await jwt('user-a', { auth_time: 9999999999 }), await jwt(''), await jwt('user-a', {}, 'none'), tokenA.slice(0, -8) + 'invalid!']) {
    const denied = await call(token, '/status');
    assert.equal(denied.status, 401);
    assert.equal(denied.headers.get('Access-Control-Allow-Origin'), 'https://app.example');
  }
  assert.equal(identities.size, 0, 'invalid credentials cannot open any account');
  for (let i = 0; i < 15; i++) assert.equal((await call(await jwt('user-a', {}, 'RS256', crypto.randomUUID()), '/status')).status, 401);
  assert.equal(keyReads, 1, 'unknown kids cannot force a Google request for every invalid login');
  const authorize = await call(tokenA, '/authorize', 'POST');
  const target = new URL(((await authorize.json()) as { url: string }).url);
  const callback = await worker.fetch(new Request(`https://bridge.example/callback?state=${target.searchParams.get('state')}&code=user-a`), env);
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get('location'), 'https://app.example/play-your-life/#ticktick=connected');
  assert.deepEqual(await (await call(tokenA, '/status')).json(), { connected: true });
  assert.deepEqual(await (await call(tokenB, '/status')).json(), { connected: false });
  const before = validateTickTickSettings(await (await call(tokenA, '/settings')).json());
  const draft = { ...before, sphereLists: { sport: 'own-list', health: '' }, links: { 'task-1': { remoteId: 'remote-1', local: 'local', remote: 'remote', projectId: 'own-list' } } };
  assert.equal((await call(tokenA, '/settings', 'PUT', { ...draft, sphereLists: { foreign: 'own-list' } })).status, 400);
  const saved = await call(tokenA, '/settings', 'PUT', { ...draft, token: 'never-persist-this', key: 'never-persist-this' });
  assert.equal(saved.status, 200);
  assert.equal((await call(tokenA, '/settings', 'PUT', draft)).status, 409, 'stale devices cannot overwrite newer settings');
  const otherDevice = validateTickTickSettings(await (await call(await jwt('user-a'), '/settings')).json());
  assert.equal(otherDevice.sphereLists.sport, 'own-list'); assert.equal(otherDevice.revision, before.revision + 1);
  assert.equal(JSON.stringify(otherDevice).includes('never-persist-this'), false);
  assert.deepEqual(await (await call(tokenB, '/settings')).json(), emptyTickTickSettings());
  assert.ok(identities.has('firebase:test-firebase:user-a')); assert.ok(identities.has('firebase:test-firebase:user-b'));
  const accountA = stores.get(identities.get('firebase:test-firebase:user-a')!)!;
  accountA.set('task:1:own-list:task-1', { id: 'from-old-ticktick' });
  const again = new URL(((await (await call(tokenA, '/authorize', 'POST')).json()) as { url: string }).url);
  await worker.fetch(new Request(`https://bridge.example/callback?state=${again.searchParams.get('state')}&code=another-ticktick`), env);
  const reset = validateTickTickSettings(await (await call(tokenA, '/settings')).json());
  assert.deepEqual(reset.links, {}); assert.deepEqual(reset.sphereLists, {}); assert.equal(reset.auto, false);
  assert.equal(accountA.get('epoch'), 2, 'creation IDs from another TickTick login are no longer reused');
  await call(tokenA, '/disconnect', 'POST');
  assert.deepEqual(await (await call(tokenA, '/status')).json(), { connected: false });
  assert.equal(accountA.has('token'), false);
  assert.deepEqual(await (await call(tokenB, '/settings')).json(), emptyTickTickSettings());
});

test('клиент берёт свежий Firebase ID token только для запроса; настройки не содержат токен', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  const connection = { ...newConnection('https://bridge.example'), ...emptyTickTickSettings(), auth: 'firebase' as const };
  let count = 0;
  globalThis.fetch = async (_url, init) => {
    assert.equal((init?.headers as Record<string, string>).Authorization, `Bearer fixture-id-token-${count}`);
    return Response.json({ connected: false });
  };
  const token = async () => `fixture-id-token-${++count}`;
  await bridgeRequest(connection, '/status', 'GET', undefined, token);
  await bridgeRequest(connection, '/status', 'GET', undefined, token);
  assert.equal(count, 2); assert.equal(JSON.stringify(connection).includes('fixture-id-token'), false);
  await assert.rejects(() => bridgeRequest(connection, '/status'), /Войдите/);
});
