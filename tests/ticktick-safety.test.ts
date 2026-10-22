import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/game.ts';
import {
  MASS_REMOVAL_MIN,
  applyTickTickResult,
  describeHeldRemovals,
  newConnection,
  stopsWholeSync,
  summarizeHeldRemovals,
  syncTickTick,
} from '../src/ticktick.ts';
import type { RemoteTask, TickTickConnection } from '../src/ticktick.ts';
import type { GameState } from '../src/game.ts';

/** Игра с N самостоятельными задачами сферы «Английский», список TickTick «life». */
function setup(count: number) {
  const state = initialState();
  state.profile = { ...state.profile, mode: 'personal', onboardingComplete: true };
  const base = state.quests[0];
  state.quests = Array.from({ length: count }, (_, i) => ({
    ...base,
    id: `t${i + 1}`,
    name: `Задача ${i + 1}`,
    goalId: undefined,
    stageId: undefined,
    sourceType: 'USER_CREATED' as const,
    done: false,
    completedAt: undefined,
  }));
  const connection = newConnection('https://bridge.example/');
  connection.projectId = 'life';
  connection.sphereLists = { english: 'life' };
  return { state, connection };
}
type Failure = { match: RegExp; status: number; times?: number };
/** Имитация TickTick: несколько списков, отказы по запросу, перенос задач. */
function upstream(failures: Failure[] = []) {
  const tasks = new Map<string, RemoteTask>();
  const calls: { path: string; method: string }[] = [];
  let counter = 0;
  async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    calls.push({ path, method });
    for (const failure of failures) {
      if (failure.match.test(`${method} ${path}`) && (failure.times ?? Infinity) > 0) {
        if (failure.times !== undefined) failure.times--;
        throw new Error(`Сбой (${failure.status})`);
      }
    }
    const payload = body as Partial<RemoteTask> & { localId?: string };
    let result: unknown;
    const project = decodeURIComponent(path.split('/')[3] ?? '');
    if (/^\/api\/project\/[^/]+\/data$/.test(path))
      result = { tasks: [...tasks.values()].filter((t) => t.status !== 2 && t.projectId === project) };
    else if (path === '/create') {
      const id = `remote-${++counter}`;
      const task = { ...payload, id, projectId: payload.projectId!, status: 0 } as RemoteTask;
      tasks.set(id, task);
      result = task;
    } else if (path.startsWith('/api/task/')) {
      const id = path.split('/').at(-1)!;
      const task = { ...tasks.get(id), ...payload } as RemoteTask;
      tasks.set(id, task);
      result = task;
    } else {
      const id = path.split('/').at(path.endsWith('/complete') ? -2 : -1)!;
      const task = tasks.get(id);
      if (!task || task.projectId !== project) throw new Error('Не найдено (404)');
      if (path.endsWith('/complete')) {
        task.status = 2;
        result = null;
      } else if (method === 'DELETE') {
        tasks.delete(id);
        result = null;
      } else result = task;
    }
    return structuredClone(result) as T;
  }
  return { request, tasks, calls };
}
async function linked(count: number) {
  const { state, connection } = setup(count);
  const api = upstream();
  const first = applyTickTickResult(state, await syncTickTick(state, connection, api.request));
  assert.equal(Object.keys(first.connection.links).length, count);
  return { state: first.state, connection: first.connection, api };
}
const remove = (state: GameState, ids: string[]): GameState => ({
  ...state,
  quests: state.quests.filter((q) => !ids.includes(q.id)),
});
const deletes = (api: ReturnType<typeof upstream>) => api.calls.filter((c) => c.method === 'DELETE').length;

test('порог массового удаления равен четырём', () => {
  assert.equal(MASS_REMOVAL_MIN, 4);
});

test('удаление нескольких задач в игре (меньше порога) доходит до TickTick без вопросов', async () => {
  const { state, connection, api } = await linked(6);
  const next = remove(state, ['t1', 't2', 't3']);
  const result = await syncTickTick(next, connection, api.request);
  assert.equal(result.held, undefined);
  assert.equal(deletes(api), 3);
  assert.equal(Object.keys(result.connection.links).length, 3);
});

test('массовое удаление в игре не доходит до TickTick без подтверждения', async () => {
  const { state, connection, api } = await linked(6);
  const next = remove(state, ['t1', 't2', 't3', 't4']);
  const result = await syncTickTick(next, connection, api.request);
  assert.equal(deletes(api), 0, 'в TickTick ничего не удалено');
  assert.equal(result.held?.inTickTick.length, 4);
  assert.equal(Object.keys(result.connection.links).length, 6, 'связи не тронуты');
  assert.equal(api.tasks.size, 6);
  // Пустая игра (например, подставилось пустое состояние) тоже не стирает TickTick.
  const empty = await syncTickTick(remove(state, state.quests.map((q) => q.id)), connection, api.request);
  assert.equal(deletes(api), 0);
  assert.equal(empty.held?.inTickTick.length, 6);
});

test('подтверждённое массовое удаление выполняется', async () => {
  const { state, connection, api } = await linked(6);
  const next = remove(state, ['t1', 't2', 't3', 't4']);
  const result = await syncTickTick(next, connection, api.request, undefined, { removals: 'confirm' });
  assert.equal(result.held, undefined);
  assert.equal(deletes(api), 4);
  assert.equal(api.tasks.size, 2);
  assert.equal(Object.keys(result.connection.links).length, 2);
});

test('отказ от массового удаления оставляет задачи в TickTick и разрывает связь', async () => {
  const { state, connection, api } = await linked(6);
  const next = remove(state, ['t1', 't2', 't3', 't4']);
  const result = await syncTickTick(next, connection, api.request, undefined, { removals: 'keep' });
  assert.equal(deletes(api), 0);
  assert.equal(api.tasks.size, 6);
  assert.equal(Object.keys(result.connection.links).length, 2);
  assert.equal(result.connection.dismissed.length, 4, 'они не вернутся во входящие');
});

test('массовое исчезновение задач из TickTick не стирает игру без подтверждения', async () => {
  const { state, connection, api } = await linked(6);
  for (const id of ['remote-1', 'remote-2', 'remote-3', 'remote-4']) api.tasks.delete(id);
  const result = await syncTickTick(state, connection, api.request);
  assert.equal(result.held?.inGame.length, 4);
  assert.deepEqual(result.removed, []);
  assert.equal(Object.keys(result.connection.links).length, 6);
  const applied = applyTickTickResult(state, result);
  assert.equal(applied.state.quests.length, 6, 'задачи в игре на месте');
});

test('подтверждённое исчезновение удаляет задачи и в игре', async () => {
  const { state, connection, api } = await linked(6);
  for (const id of ['remote-1', 'remote-2', 'remote-3', 'remote-4']) api.tasks.delete(id);
  const result = await syncTickTick(state, connection, api.request, undefined, { removals: 'confirm' });
  assert.equal(result.held, undefined);
  assert.equal(result.removed.length, 4);
  assert.equal(applyTickTickResult(state, result).state.quests.length, 2);
});

test('отказ оставляет задачи в игре и создаёт их в TickTick заново, без дублей', async () => {
  const { state, connection, api } = await linked(6);
  for (const id of ['remote-1', 'remote-2', 'remote-3', 'remote-4']) api.tasks.delete(id);
  const kept = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request, undefined, { removals: 'keep' }),
  );
  assert.equal(kept.state.quests.length, 6);
  const again = applyTickTickResult(
    kept.state,
    await syncTickTick(kept.state, kept.connection, api.request),
  );
  assert.equal(Object.keys(again.connection.links).length, 6);
  assert.equal(api.tasks.size, 6, 'в TickTick снова шесть задач');
});

test('малое число исчезнувших задач удаляется сразу, как раньше', async () => {
  const { state, connection, api } = await linked(6);
  api.tasks.delete('remote-1');
  api.tasks.delete('remote-2');
  const result = await syncTickTick(state, connection, api.request);
  assert.equal(result.held, undefined);
  assert.equal(result.removed.length, 2);
});

test('выполненные задачи не считаются исчезнувшими и не блокируют обмен', async () => {
  const { state, connection, api } = await linked(6);
  const done = {
    ...state,
    quests: state.quests.map((q) => (q.id < 't5' ? { ...q, done: true, completedAt: new Date().toISOString() } : q)),
  };
  for (const id of ['remote-1', 'remote-2', 'remote-3', 'remote-4']) api.tasks.delete(id);
  const result = await syncTickTick(done, connection, api.request);
  assert.equal(result.held, undefined);
  assert.deepEqual(result.removed, []);
});

test('сбой одной задачи не отменяет обмен остальными', async () => {
  const { state, connection, api } = await linked(5);
  const edited = {
    ...state,
    quests: state.quests.map((q) => ({ ...q, name: `${q.name} (правка)` })),
  };
  const failing = upstream();
  failing.tasks = api.tasks;
  const broken = upstream([{ match: /POST \/api\/task\/remote-3$/, status: 400, times: 1 }]);
  broken.tasks.clear();
  for (const [id, task] of api.tasks) broken.tasks.set(id, task);
  const result = await syncTickTick(edited, connection, broken.request);
  assert.equal(result.stopped, undefined);
  assert.equal(result.warnings.filter((w) => w.startsWith('Задача 3 (правка):')).length, 1);
  for (const id of ['remote-1', 'remote-2', 'remote-4', 'remote-5'])
    assert.match(broken.tasks.get(id)!.title, /\(правка\)$/, `${id} обновлена`);
  assert.doesNotMatch(broken.tasks.get('remote-3')!.title, /\(правка\)$/);
  assert.equal(Object.keys(result.connection.links).length, 5, 'связи сохранены');
  // Неудавшаяся задача передаётся при следующем обмене.
  const retry = await syncTickTick(edited, result.connection, broken.request);
  assert.match(broken.tasks.get('remote-3')!.title, /\(правка\)$/);
  assert.deepEqual(retry.warnings.filter((w) => w.startsWith('Задача 3')), []);
});

test('параллельные правки разных полей объединяются в обе стороны', async () => {
  const { state: linkedState, connection, api } = await linked(1);
  let state = linkedState;
  const id = state.quests[0].id;
  const remoteId = connection.links[id].remoteId;
  state = {
    ...state,
    quests: state.quests.map((q) => q.id === id ? { ...q, name: 'Новое название в игре' } : q),
  };
  api.tasks.get(remoteId)!.dueDate = '2026-12-10T00:00:00+0000';

  const result = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  assert.equal(result.state.quests[0].name, 'Новое название в игре');
  assert.equal(result.state.quests[0].dueAt, '2026-12-10');
  assert.equal(api.tasks.get(remoteId)!.title, 'Новое название в игре');
  assert.match(api.tasks.get(remoteId)!.dueDate!, /^2026-12-10/);
  assert.deepEqual(result.warnings, []);
});

test('сбой создания одной задачи сохраняет связи остальных новых задач', async () => {
  const { state, connection } = setup(4);
  const api = upstream([{ match: /POST \/create$/, status: 400, times: 1 }]);
  const result = await syncTickTick(state, connection, api.request);
  assert.equal(Object.keys(result.connection.links).length, 3);
  assert.equal(api.tasks.size, 3);
  assert.equal(result.warnings.length, 1);
  const retry = await syncTickTick(state, result.connection, api.request);
  assert.equal(Object.keys(retry.connection.links).length, 4);
  assert.equal(api.tasks.size, 4, 'повтор не создаёт копий');
});

test('потеря доступа останавливает обмен, выполненное сохраняется', async () => {
  const { state, connection } = setup(4);
  const api = upstream();
  // Первая задача создаётся успешно: пропускаем один вызов, затем доступ пропадает.
  let created = 0;
  const request = async <T,>(path: string, method?: string, body?: unknown): Promise<T> => {
    if (path === '/create' && ++created === 2) throw new Error('Доступ истёк (401)');
    return api.request<T>(path, method, body);
  };
  const result = await syncTickTick(state, connection, request);
  assert.equal(Object.keys(result.connection.links).length, 1, 'созданная до сбоя задача связана');
  assert.match(result.stopped ?? '', /\(401\)$/);
  assert.equal(api.tasks.size, 1, 'остальные не отправлялись');
});

test('нет сети и лимит запросов останавливают обмен, а не множат ошибки', () => {
  assert.equal(stopsWholeSync(new TypeError('Failed to fetch')), true);
  assert.equal(stopsWholeSync(Object.assign(new Error('x'), { name: 'TimeoutError' })), true);
  for (const code of [401, 403, 429, 500, 502, 503])
    assert.equal(stopsWholeSync(new Error(`Ошибка (${code})`)), true, String(code));
  for (const code of [400, 404, 409])
    assert.equal(stopsWholeSync(new Error(`Ошибка (${code})`)), false, String(code));
  assert.equal(stopsWholeSync('строка'), false);
});

test('задача, перенесённая в другой сопоставленный список, не удаляется в игре', async () => {
  const state = initialState();
  state.profile = { ...state.profile, mode: 'personal', onboardingComplete: true };
  const base = state.quests[0];
  state.quests = [1, 2, 3, 4, 5].map((i) => ({
    ...base,
    id: `m${i}`,
    name: `Перенос ${i}`,
    goalId: undefined,
    stageId: undefined,
    sourceType: 'USER_CREATED' as const,
    done: false,
  }));
  const connection: TickTickConnection = newConnection('https://bridge.example/');
  connection.projectId = 'life';
  connection.sphereLists = { english: 'life', health: 'other' };
  const api = upstream();
  const first = applyTickTickResult(state, await syncTickTick(state, connection, api.request));
  // Пользователь перенёс все пять задач в другой список TickTick.
  for (const task of api.tasks.values()) task.projectId = 'other';
  const second = await syncTickTick(first.state, first.connection, api.request);
  assert.equal(second.held, undefined);
  assert.deepEqual(second.removed, []);
  assert.deepEqual(
    Object.values(second.connection.links).map((link) => link.projectId),
    Array(5).fill('other'),
    'связи следуют за задачами',
  );
  assert.equal(deletes(api), 0);
});

test('тексты вопроса: склонение, перечень и пояснение отказа', () => {
  const held = {
    inTickTick: [1, 2, 3, 4, 5].map((i) => ({ id: `a${i}`, name: `Дело ${i}` })),
    inGame: [1, 2, 3, 4].map((i) => ({ id: `b${i}`, name: `Шаг ${i}` })),
  };
  const text = describeHeldRemovals(held);
  assert.match(text, /5 задач: «Дело 1», «Дело 2», «Дело 3» и ещё 2/);
  assert.match(text, /4 задачи: «Шаг 1», «Шаг 2», «Шаг 3» и ещё 1/);
  assert.match(text, /Отмена/);
  assert.match(summarizeHeldRemovals(held), /в TickTick — 5 задач, в игре — 4 задачи/);
  assert.match(summarizeHeldRemovals({ inTickTick: held.inTickTick, inGame: [] }), /^Обмен остановил массовое удаление \(в TickTick — 5 задач\)/);
});
