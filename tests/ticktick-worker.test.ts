import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { TickTickAccount } from '../integrations/ticktick/worker.ts';
import type { Storage, Env } from '../integrations/ticktick/worker.ts';
function fixture() {
  const entries = new Map<string, unknown>();
  const storage: Storage = {
    get: async <T>(key: string) => entries.get(key) as T | undefined,
    put: async (key, value) => {
      entries.set(key, structuredClone(value));
    },
    delete: async (key) => entries.delete(key),
  };
  const env: Env = {
    APP_URL: 'https://app.example/life/',
    TICKTICK_CLIENT_ID: 'test-client',
    TICKTICK_CLIENT_SECRET: 'test-secret',
    ACCOUNTS: {
      idFromName: () => ({ toString: () => 'a'.repeat(64) }),
      idFromString: () => ({ toString: () => 'a'.repeat(64) }),
      get: () => ({ fetch: (r) => account.fetch(r) }),
    },
  };
  const account = new TickTickAccount({ storage }, env);
  return { entries, storage, env, account };
}
const request = (path: string, method = 'GET', payload?: unknown) =>
  new Request(`https://bridge.example${path}`, {
    method,
    headers: {
      Origin: 'https://app.example',
      Authorization: `Bearer ${'b'.repeat(64)}`,
      'Content-Type': 'application/json',
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
test('OAuth-сервер отклоняет чужой сайт, неполную настройку и произвольный upstream', async () => {
  const f = fixture();
  assert.equal(
    (await worker.fetch(new Request('https://bridge.example/status'), f.env))
      .status,
    403,
  );
  assert.equal(
    (
      await worker.fetch(request('/status'), {
        ...f.env,
        TICKTICK_CLIENT_SECRET: '',
      })
    ).status,
    503,
  );
  assert.equal(
    (await worker.fetch(request('/api/user/password'), f.env)).status,
    404,
  );
  const options = await worker.fetch(request('/status', 'OPTIONS'), f.env);
  assert.equal(options.status, 204);
  assert.equal(
    options.headers.get('Access-Control-Allow-Origin'),
    'https://app.example',
  );
});
test('OAuth state одноразовый, просроченный и чужой state не дают доступ', async () => {
  const f = fixture();
  const response = await worker.fetch(request('/authorize', 'POST'), f.env);
  assert.equal(response.status, 200);
  const data = (await response.json()) as { url: string };
  const state = new URL(data.url).searchParams.get('state')!;
  assert.match(state, /^[a-f0-9]{64}\.[a-f0-9]{64}$/);
  assert.equal(
    new URL(data.url).searchParams.get('scope'),
    'tasks:read tasks:write',
  );
  assert.equal(
    (
      await worker.fetch(
        new Request(
          `https://bridge.example/callback?state=${'a'.repeat(64)}.wrong&code=x`,
        ),
        f.env,
      )
    ).status,
    400,
  );
  const pending = f.entries.get('pending') as {
    state: string;
    expires: number;
    callback: string;
  };
  f.entries.set('pending', { ...pending, expires: 0 });
  assert.equal(
    (
      await worker.fetch(
        new Request(`https://bridge.example/callback?state=${state}&code=x`),
        f.env,
      )
    ).status,
    400,
  );
});
test('OAuth сохраняет токен только на сервере и возвращает статус без секрета', async (t) => {
  const f = fixture();
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), 'https://ticktick.com/oauth/token');
    assert.match(
      String((init?.headers as Record<string, string>).Authorization),
      /^Basic /,
    );
    return Response.json({
      access_token: 'provider-token',
      refresh_token: 'refresh',
      expires_in: 3600,
    });
  };
  const begin = await worker.fetch(request('/authorize', 'POST'), f.env);
  const { url } = (await begin.json()) as { url: string };
  const state = new URL(url).searchParams.get('state');
  const response = await worker.fetch(
    new Request(`https://bridge.example/callback?state=${state}&code=code`),
    f.env,
  );
  assert.equal(response.status, 302);
  assert.equal(
    response.headers.get('location'),
    'https://app.example/life/#ticktick=connected',
  );
  assert.ok(f.entries.has('token'));
  assert.equal(f.entries.has('pending'), false);
  assert.equal(
    (
      await worker.fetch(
        new Request(`https://bridge.example/callback?state=${state}&code=code`),
        f.env,
      )
    ).status,
    400,
  );
  const status = await worker.fetch(request('/status'), f.env);
  assert.deepEqual(await status.json(), { connected: true });
  await worker.fetch(request('/disconnect', 'POST'), f.env);
  assert.equal(f.entries.has('token'), false);
});
test('сервер останавливает повторное создание и восстанавливает подтверждённую задачу', async (t) => {
  const f = fixture();
  await f.storage.put('token', {
    access_token: 'provider-token',
    expiresAt: Date.now() + 3600000,
  });
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  let created = 0;
  const task = {
    id: 'remote-1',
    title: 'Шаг',
    projectId: 'life',
    content: '\n[PYL:local-1]',
  };
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/data'))
      return Response.json({ tasks: created ? [task] : [] });
    if (path.endsWith('/task/remote-1')) return Response.json(task);
    if (init?.method === 'POST') {
      created++;
      return Response.json(task);
    }
    throw new Error('Unexpected request');
  };
  const payload = {
    localId: 'local-1',
    title: 'Шаг',
    content: 'Заметки',
    projectId: 'life',
  };
  assert.equal(
    (await worker.fetch(request('/create', 'POST', payload), f.env)).status,
    200,
  );
  assert.equal(
    (await worker.fetch(request('/create', 'POST', payload), f.env)).status,
    200,
  );
  assert.equal(created, 1);
  await f.storage.put('task:life:local-1', { pending: true });
  assert.equal(
    (await worker.fetch(request('/create', 'POST', payload), f.env)).status,
    200,
  );
  assert.equal(created, 1);
});
test('неподтверждённое создание не повторяется после сетевой ошибки', async (t) => {
  const f = fixture();
  await f.storage.put('token', {
    access_token: 'provider-token',
    expiresAt: Date.now() + 3600000,
  });
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  let attempted = 0;
  globalThis.fetch = async (input) => {
    if (String(input).endsWith('/data')) return Response.json({ tasks: [] });
    attempted++;
    throw new Error('Network failed');
  };
  const payload = {
    localId: 'local-1',
    title: 'Шаг',
    content: 'Заметки',
    projectId: 'life',
  };
  assert.equal(
    (await worker.fetch(request('/create', 'POST', payload), f.env)).status,
    500,
  );
  assert.equal(
    (await worker.fetch(request('/create', 'POST', payload), f.env)).status,
    409,
  );
  assert.equal(attempted, 1);
});
