import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { TickTickAccount } from '../integrations/ticktick/worker.ts';
import type { Env, Storage } from '../integrations/ticktick/worker.ts';
import { emptyHabitLinks } from '../src/ticktickHabits.ts';

function fixture() {
  const entries = new Map<string, unknown>();
  const storage: Storage = {
    get: async <T>(key: string) => entries.get(key) as T | undefined,
    put: async (key, value) => { entries.set(key, structuredClone(value)); },
    delete: async (key) => entries.delete(key),
  };
  const env: Env = {
    APP_URL: 'https://app.example/life/',
    TICKTICK_CLIENT_ID: 'test-client',
    TICKTICK_CLIENT_SECRET: 'test-secret',
    TICKTICK_MCP_URL: 'https://mcp.example/',
    ACCOUNTS: { idFromName: () => ({ toString: () => 'a'.repeat(64) }), idFromString: () => ({ toString: () => 'a'.repeat(64) }), get: () => ({ fetch: (r) => account.fetch(r) }) },
  };
  const account = new TickTickAccount({ storage }, env);
  return { entries, storage, env };
}
const request = (path: string, method = 'GET', payload?: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://bridge.example${path}`, {
    method,
    headers: { Origin: 'https://app.example', Authorization: `Bearer ${'b'.repeat(64)}`, 'Content-Type': 'application/json', ...headers },
    body: payload ? JSON.stringify(payload) : undefined,
  });
async function connected(f: ReturnType<typeof fixture>, expiresAt = Date.now() + 3600000) {
  await f.storage.put('token', { access_token: 'provider-secret-token', refresh_token: 'refresh-secret-token', expiresAt });
}

type Mock = { calls: { tool: string; args: Record<string, unknown>; auth: string | null }[]; status: number; sse: boolean; fail: boolean };
function mockMcp(t: { after: (fn: () => void) => void }): Mock {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const mock: Mock = { calls: [], status: 200, sse: false, fail: false };
  const reply = (id: number, result: unknown) => {
    const message = JSON.stringify({ jsonrpc: '2.0', id, result });
    return mock.sse
      ? new Response(`event: message\ndata: ${message}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } })
      : new Response(message, { headers: { 'Content-Type': 'application/json' } });
  };
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.origin === 'https://ticktick.com') return Response.json({ access_token: 'fresh-token', expires_in: 3600 });
    if (url.origin !== 'https://mcp.example') throw new Error(`Unexpected request ${url}`);
    if (mock.status !== 200) return new Response('no', { status: mock.status });
    const body = JSON.parse(String(init?.body));
    if (body.method === 'initialize') return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-03-26' } }), { headers: { 'Content-Type': 'application/json', 'Mcp-Session-Id': 'session-1' } });
    if (body.method === 'notifications/initialized') return new Response(null, { status: 202 });
    const tool = body.params.name as string;
    const auth = new Headers(init?.headers).get('Authorization');
    mock.calls.push({ tool, args: body.params.arguments, auth });
    if (mock.fail) return reply(2, { isError: true, content: [{ type: 'text', text: 'boom' }] });
    const data: Record<string, unknown> = {
      // Реальный MCP TickTick оборачивает списки в «result» (проверено на живом аккаунте), не в
      // «sections»/«habits» — фикстура повторяет настоящую форму, чтобы тест ловил этот класс ошибки.
      list_habit_sections: { result: [{ id: 'section-1', name: 'Health' }] },
      list_habits: { result: [{ id: 'habit-1', name: 'Читать', iconRes: 'habit_reading', color: '#4D8CF5', status: 0, goal: 1, step: 1, unit: 'Count', repeatRule: 'RRULE:FREQ=DAILY;INTERVAL=1', reminders: ['21:00'], sectionId: 'section-1', modifiedTime: 1792404000000, etag: 'e', totalCheckIns: 3, targetDays: 7, targetStartDate: 20261021, accessToken: 'must-not-leak' }] },
      get_habit_checkins: { habit_1: [{ habitId: 'habit-1', stamp: 20261019, value: 1, goal: 1, status: 2 }] },
      upsert_habit_checkins: { ok: true },
      update_habit: { ok: true },
    };
    return reply(2, { content: [{ type: 'text', text: JSON.stringify(data[tool]) }] });
  };
  return mock;
}

test('/habits: неавторизованный пользователь получает 401 с кодом, чужой origin 403', async () => {
  const f = fixture();
  const anonymous = await worker.fetch(request('/habits', 'GET', undefined, { Authorization: '' }), f.env);
  assert.equal(anonymous.status, 401);
  assert.equal(((await anonymous.json()) as { code: string }).code, 'PLAY_LIFE_AUTH_REQUIRED');
  const foreign = await worker.fetch(request('/habits', 'GET', undefined, { Origin: 'https://evil.example' }), f.env);
  assert.equal(foreign.status, 403);
  // Путь приложения не считается origin.
  const path = await worker.fetch(request('/habits', 'GET', undefined, { Origin: 'https://app.example/life' }), f.env);
  assert.equal(path.status, 403);
});

test('/habits без подключения TickTick просит подключиться', async (t) => {
  mockMcp(t);
  const f = fixture();
  const response = await worker.fetch(request('/habits'), f.env);
  assert.equal(response.status, 401);
  assert.equal(((await response.json()) as { code: string }).code, 'TICKTICK_AUTH_REQUIRED');
});

test('/habits возвращает нормализованные привычки и разделы без токенов', async (t) => {
  const mock = mockMcp(t);
  const f = fixture();
  await connected(f);
  const response = await worker.fetch(request('/habits'), f.env);
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.ok(!text.includes('provider-secret-token') && !text.includes('refresh-secret-token') && !text.includes('must-not-leak'));
  const data = JSON.parse(text) as { items: { ticktickHabitId: string; icon: string; sectionName: string; modifiedAt: string; targetDays: number; targetStartDate: string; reminders: string[] }[]; sections: unknown[] };
  assert.equal(data.items[0].ticktickHabitId, 'habit-1');
  assert.equal(data.items[0].icon, 'reading');
  assert.equal(data.items[0].sectionName, 'Health');
  assert.equal(data.items[0].modifiedAt, '2026-10-19T10:00:00.000Z');
  assert.equal(data.items[0].targetDays, 7);
  assert.equal(data.items[0].targetStartDate, '2026-10-21');
  assert.deepEqual(data.items[0].reminders, ['21:00']);
  assert.deepEqual(mock.calls.map((c) => c.tool).sort(), ['list_habit_sections', 'list_habits']);
  assert.ok(mock.calls.every((c) => c.auth === 'Bearer provider-secret-token'));
});

test('ответ MCP в формате SSE разбирается', async (t) => {
  const mock = mockMcp(t);
  mock.sse = true;
  const f = fixture();
  await connected(f);
  const response = await worker.fetch(request('/habits'), f.env);
  assert.equal(response.status, 200);
  assert.equal(((await response.json()) as { items: unknown[] }).items.length, 1);
});

test('истёкший access token обновляется перед запросом привычек', async (t) => {
  const mock = mockMcp(t);
  const f = fixture();
  await connected(f, Date.now() - 1000);
  const response = await worker.fetch(request('/habits'), f.env);
  assert.equal(response.status, 200);
  assert.ok(mock.calls.every((c) => c.auth === 'Bearer fresh-token'));
  assert.equal(((f.entries.get('token') as { access_token: string }).access_token), 'fresh-token');
});

test('ошибки TickTick дают безопасные коды: 401, отказ в доступе к привычкам, лимит, сбой', async (t) => {
  const mock = mockMcp(t);
  const f = fixture();
  await connected(f);
  for (const [status, code] of [[401, 'TICKTICK_AUTH_REQUIRED'], [403, 'TICKTICK_HABIT_SCOPE_DENIED'], [429, 'TICKTICK_RATE_LIMIT'], [500, 'TICKTICK_REQUEST_FAILED']] as const) {
    mock.status = status;
    const response = await worker.fetch(request('/habits'), f.env);
    assert.equal(response.status, status === 500 ? 502 : status);
    assert.equal(((await response.json()) as { code: string }).code, code);
  }
  mock.status = 200; mock.fail = true;
  const failed = await worker.fetch(request('/habits'), f.env);
  assert.equal(failed.status, 502);
  assert.equal(((await failed.json()) as { code: string }).code, 'TICKTICK_HABITS_ERROR');
});

test('/habits/checkins проверяет период и список, возвращает историю', async (t) => {
  const mock = mockMcp(t);
  const f = fixture();
  await connected(f);
  for (const query of ['', '?from=2026-10-19&to=2026-07-01&habitIds=habit-1', '?from=2020-01-01&to=2026-10-19&habitIds=habit-1', '?from=2026-07-21&to=2026-10-19', '?from=2026-07-21&to=2026-10-19&habitIds=bad%20id'])
    assert.equal((await worker.fetch(request(`/habits/checkins${query}`), f.env)).status, 400, query);
  const ok = await worker.fetch(request('/habits/checkins?from=2026-07-21&to=2026-10-19&habitIds=habit-1'), f.env);
  assert.equal(ok.status, 200);
  const data = (await ok.json()) as { items: { day: string; completed: boolean }[] };
  assert.deepEqual(data.items.map((i) => [i.day, i.completed]), [['2026-10-19', true]]);
  assert.deepEqual(mock.calls[0].args, { habit_ids: ['habit-1'], from_stamp: 20260721, to_stamp: 20261019 });
});

test('POST /habits/checkin идемпотентен: повтор не обращается к TickTick второй раз', async (t) => {
  const mock = mockMcp(t);
  const f = fixture();
  await connected(f);
  const payload = { ticktickHabitId: 'habit-1', date: '2026-10-19', value: 1, goal: 1, idempotencyKey: 'checkin:local-123:20261019:1' };
  const first = await worker.fetch(request('/habits/checkin', 'POST', payload), f.env);
  assert.equal(first.status, 200);
  assert.equal(((await first.json()) as { status: string }).status, 'synced');
  const second = await worker.fetch(request('/habits/checkin', 'POST', payload), f.env);
  assert.equal(((await second.json()) as { repeated: boolean }).repeated, true);
  assert.equal(mock.calls.filter((c) => c.tool === 'upsert_habit_checkins').length, 1);
  const sent = mock.calls[0].args as { habit_id: string; checkin_data: { stamp: number; status: number; value: number } };
  assert.equal(sent.habit_id, 'habit-1');
  assert.equal(sent.checkin_data.stamp, 20261019);
  assert.equal(sent.checkin_data.status, 2);
});

test('POST /habits/checkin отклоняет некорректные отметки и будущие даты', async (t) => {
  const mock = mockMcp(t);
  const f = fixture();
  await connected(f);
  const base = { ticktickHabitId: 'habit-1', date: '2026-10-19', value: 1, goal: 1, idempotencyKey: 'checkin:local-123:20261019:1' };
  for (const bad of [{ ...base, ticktickHabitId: '../x' }, { ...base, date: '19.10.2026' }, { ...base, value: -1 }, { ...base, goal: 0 }, { ...base, idempotencyKey: 'x' }, { ...base, completed: 'yes' }, { ...base, date: '2099-01-01' }])
    assert.equal((await worker.fetch(request('/habits/checkin', 'POST', bad), f.env)).status, 400, JSON.stringify(bad));
  assert.equal(mock.calls.length, 0);
});

test('POST /habits/archive переводит привычку TickTick в архив через update_habit (status 2)', async (t) => {
  const mock = mockMcp(t);
  const f = fixture();
  await connected(f);
  const response = await worker.fetch(request('/habits/archive', 'POST', { ticktickHabitId: 'habit-1' }), f.env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'archived', ticktickHabitId: 'habit-1' });
  assert.equal(mock.calls.length, 1);
  assert.equal(mock.calls[0].tool, 'update_habit');
  assert.deepEqual(mock.calls[0].args, { habit_id: 'habit-1', habit: { id: 'habit-1', status: 2 } });
  assert.equal(mock.calls[0].auth, 'Bearer provider-secret-token');
});

test('POST /habits/archive требует подключения TickTick и корректный id привычки', async (t) => {
  const mock = mockMcp(t);
  const f = fixture();
  const anonymous = await worker.fetch(request('/habits/archive', 'POST', { ticktickHabitId: 'habit-1' }), f.env);
  assert.equal(anonymous.status, 401);
  assert.equal(((await anonymous.json()) as { code: string }).code, 'TICKTICK_AUTH_REQUIRED');
  await connected(f);
  for (const bad of [{}, { ticktickHabitId: '../x' }, { ticktickHabitId: 123 }, { ticktickHabitId: '' }])
    assert.equal((await worker.fetch(request('/habits/archive', 'POST', bad), f.env)).status, 400, JSON.stringify(bad));
  assert.equal(mock.calls.length, 0);
});

test('связи привычек: сохранение по ревизии, устаревшая ревизия отклоняется, отключение очищает', async (t) => {
  mockMcp(t);
  const f = fixture();
  await connected(f);
  assert.deepEqual(await (await worker.fetch(request('/habits/links'), f.env)).json(), emptyHabitLinks());
  const state = {
    ...emptyHabitLinks(),
    links: { 'local-1': { ticktickHabitId: 'habit-1', sectionId: 'section-1', iconRes: 'habit_reading', syncDirection: 'bidirectional', status: 'active', lastTicktickModifiedAt: '2026-10-19T10:00:00.000Z', lastLocalModifiedAt: '', lastSyncedCheckinDate: '2026-10-19' } },
    imported: ['ticktick:habit-1:20261019'],
  };
  const saved = await worker.fetch(request('/habits/links', 'PUT', state), f.env);
  assert.equal(saved.status, 200);
  assert.equal(((await saved.json()) as { revision: number }).revision, 1);
  const stale = await worker.fetch(request('/habits/links', 'PUT', state), f.env);
  assert.equal(stale.status, 409);
  assert.equal((await worker.fetch(request('/habits/links', 'PUT', { ...state, revision: 1, links: { 'bad id': {} } }), f.env)).status, 400);
  await worker.fetch(request('/disconnect', 'POST'), f.env);
  const after = (await (await worker.fetch(request('/habits/links'), f.env)).json()) as { links: object; imported: string[]; revision: number };
  assert.deepEqual(after.links, {});
  assert.deepEqual(after.imported, []);
  assert.equal(f.entries.has('habitKeys'), false);
  assert.ok(after.revision > 1);
});

test('маршруты привычек недоступны без токена для записи связей', async () => {
  const f = fixture();
  assert.equal((await worker.fetch(request('/habits/links', 'PUT', emptyHabitLinks()), f.env)).status, 401);
});

test('лимит запросов привычек: после 60 запросов в минуту сервер отвечает 429, прочие маршруты не затронуты', async (t) => {
  mockMcp(t);
  const f = fixture();
  await connected(f);
  for (let i = 0; i < 60; i++) assert.equal((await worker.fetch(request('/habits/links'), f.env)).status, 200);
  const limited = await worker.fetch(request('/habits/links'), f.env);
  assert.equal(limited.status, 429);
  assert.equal(((await limited.json()) as { code: string }).code, 'RATE_LIMITED');
  assert.equal((await worker.fetch(request('/status'), f.env)).status, 200);
});
