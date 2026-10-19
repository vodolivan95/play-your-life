import assert from 'node:assert/strict';
import test from 'node:test';
import { initialState, completeQuest, isOverdue, hasClockTime } from '../src/game.ts';
import { saveStage, saveTask, removeStage } from '../src/planning.ts';
import { stageAccess } from '../src/goalWorkspace.ts';
import { adoptBackupOwner } from '../src/backup.ts';
import { emptyTickTickSettings, validateTickTickSettings } from '../src/ticktickSettings.ts';
import worker, { TickTickAccount } from '../integrations/ticktick/worker.ts';
import type { Storage, Env } from '../integrations/ticktick/worker.ts';

test('удаление этапа снимает зависимость у следующего этапа', () => {
  let s = initialState();
  s.profile = { ...s.profile, mode: 'personal', onboardingComplete: true };
  const goal = s.goals[0].id;
  s = saveStage(s, goal, { name: 'A' });
  const a = s.goals[0].stages![0].id;
  s = saveStage(s, goal, { name: 'B', prerequisiteId: a });
  const b = s.goals[0].stages![1].id;
  s = saveTask(s, { name: 'Задача B', sphere: 'english', difficulty: 'Simple', goalId: goal, stageId: b });
  const taskId = s.quests.at(-1)!.id;
  s = removeStage(s, goal, a);
  const stageB = s.goals[0].stages!.find((x) => x.id === b)!;
  assert.equal(stageB.prerequisiteId, undefined);
  assert.ok(!stageAccess(s, s.goals[0], stageB));
  assert.ok(completeQuest(s, taskId).xp > s.xp);
});

test('срок только датой не просрочен в тот же день', () => {
  const now = new Date(2026, 9, 19, 23, 0);
  assert.equal(isOverdue('2026-10-19', now), false);
  assert.equal(isOverdue('2026-10-18', now), true);
  assert.equal(isOverdue(new Date(2026, 9, 19, 22, 0).toISOString(), now), true);
  assert.equal(isOverdue(undefined, now), false);
  assert.equal(hasClockTime('2026-10-19'), false);
  assert.equal(hasClockTime('2026-10-19T10:00:00.000Z'), true);
});

test('настройки TickTick чистятся при переполнении, а не отклоняются', () => {
  const links: Record<string, unknown> = {};
  for (let i = 0; i < 1100; i++) links[`t${i}`] = { remoteId: `r${i}`, local: 'a', remote: 'b', done: i < 200 };
  const settings = validateTickTickSettings({
    ...emptyTickTickSettings(),
    links,
    dismissed: Array.from({ length: 2100 }, (_, i) => `d${i}`),
  });
  assert.equal(Object.keys(settings.links).length, 1000);
  assert.equal(settings.dismissed.length, 2000);
  assert.equal(settings.dismissed.at(-1), 'd2099');
  assert.equal(settings.links['t1099'] !== undefined, true);
});

test('копия из другого аккаунта получает владельца текущего', () => {
  let s = initialState();
  s.profile = { ...s.profile, mode: 'personal', onboardingComplete: true };
  s = { ...s, quests: s.quests.map((q) => ({ ...q, ownerId: 'other-user' })) };
  const next = adoptBackupOwner(s, 'me');
  assert.ok(next.quests.every((q) => q.ownerId === 'me' || !q.ownerId));
});

function fixture() {
  const entries = new Map<string, unknown>();
  const storage: Storage = {
    get: async <T>(key: string) => entries.get(key) as T | undefined,
    put: async (key, value) => { entries.set(key, structuredClone(value)); },
    delete: async (key) => entries.delete(key),
  };
  const env: Env = {
    APP_URL: 'https://app.example/life/',
    TICKTICK_CLIENT_ID: 'c',
    TICKTICK_CLIENT_SECRET: 's',
    ACCOUNTS: {
      idFromName: () => ({ toString: () => 'a'.repeat(64) }),
      idFromString: () => ({ toString: () => 'a'.repeat(64) }),
      get: () => ({ fetch: (r) => account.fetch(r) }),
    },
  };
  const account = new TickTickAccount({ storage }, env);
  return { entries, storage, env };
}
const create = (payload: unknown) =>
  new Request('https://bridge.example/create', {
    method: 'POST',
    headers: { Origin: 'https://app.example', Authorization: `Bearer ${'b'.repeat(64)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
const payload = { localId: 'local-1', title: 'Шаг', content: 'Заметки', projectId: 'life' };

test('отказ TickTick 4xx не блокирует повторное создание', async (t) => {
  const f = fixture();
  await f.storage.put('token', { access_token: 'x', expiresAt: Date.now() + 3600000 });
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  let mode: 'reject' | 'ok' = 'reject';
  let created = 0;
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith('/data')) return Response.json({ tasks: [] });
    if (init?.method === 'POST') {
      if (mode === 'reject') return new Response('bad', { status: 400 });
      created++;
      return Response.json({ id: 'remote-1', title: 'Шаг' });
    }
    throw new Error('unexpected');
  };
  assert.equal((await worker.fetch(create(payload), f.env)).status, 502);
  mode = 'ok';
  assert.equal((await worker.fetch(create(payload), f.env)).status, 200);
  assert.equal(created, 1);
});

test('старая метка ожидания не блокирует создание навсегда', async (t) => {
  const f = fixture();
  await f.storage.put('token', { access_token: 'x', expiresAt: Date.now() + 3600000 });
  await f.storage.put('task:life:local-1', { pending: true, at: Date.now() - 3600000 });
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith('/data')) return Response.json({ tasks: [] });
    if (init?.method === 'POST') return Response.json({ id: 'remote-1', title: 'Шаг' });
    throw new Error('unexpected');
  };
  assert.equal((await worker.fetch(create(payload), f.env)).status, 200);
});
