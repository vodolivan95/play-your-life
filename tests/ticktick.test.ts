import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, removeQuest } from '../src/game.ts';
import { saveGoal, saveTask } from '../src/planning.ts';
import {
  applyTickTickResult,
  newConnection,
  syncTickTick,
} from '../src/ticktick.ts';
import type { RemoteTask } from '../src/ticktick.ts';
function setup() {
  const state = initialState();
  state.profile = {
    ...state.profile,
    mode: 'personal',
    onboardingComplete: true,
  };
  state.quests = [state.quests[0]];
  const connection = newConnection('https://bridge.example/');
  connection.projectId = 'life';
  return { state, connection };
}
function upstream(initial: RemoteTask[] = []) {
  const tasks = new Map(initial.map((t) => [t.id, { ...t }]));
  const calls: { path: string; method: string; body?: unknown }[] = [];
  async function request<T>(
    path: string,
    method = 'GET',
    body?: unknown,
  ): Promise<T> {
    calls.push({ path, method, body });
    let result: unknown;
    const payload = body as Partial<RemoteTask> & { localId?: string };
    if (path === '/api/project/life/data')
      result = { tasks: [...tasks.values()].filter((t) => t.status !== 2) };
    else if (path === '/create') {
      const id = `remote-${tasks.size + 1}`;
      const task = {
        ...payload,
        id,
        projectId: 'life',
        status: 0,
      } as RemoteTask;
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
      if (!task) throw new Error('Не найдено (404)');
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
const remote = (id: string, title = 'Из TickTick'): RemoteTask => ({
  id,
  projectId: 'life',
  title,
  content: 'Реальная задача',
  priority: 3,
  status: 0,
});
test('подключение принимает только корневой HTTPS адрес и создаёт случайный ключ', () => {
  assert.throws(() => newConnection('http://example.com'));
  assert.throws(() => newConnection('https://login:secret@example.com'));
  assert.throws(() => newConnection('https://example.com/api'));
  const first = newConnection('https://example.com');
  assert.match(first.key, /^[a-f0-9]{64}$/);
  assert.notEqual(first.key, newConnection('https://example.com').key);
});
test('создание и повторная синхронизация не создают копии и не выдают XP', async () => {
  let { state, connection } = setup();
  const api = upstream();
  let result = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  state = result.state;
  connection = result.connection;
  assert.equal(state.xp, 2450);
  assert.equal(Object.keys(connection.links).length, 1);
  result = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  assert.equal(api.calls.filter((c) => c.path === '/create').length, 1);
  assert.equal(result.state.xp, 2450);
});
test('редактирование в обе стороны, выполнение и повторное открытие не фармят XP', async () => {
  let { state, connection } = setup();
  const api = upstream();
  let applied = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  state = applied.state;
  connection = applied.connection;
  const id = state.quests[0].id;
  const rid = connection.links[id].remoteId;
  state = saveTask(state, {
    ...state.quests[0],
    name: 'Новый шаг',
    startsAt: '2027-03-01T10:00:00.000Z',
    dueAt: '2027-03-01T11:00:00.000Z',
    priority: 'high',
  });
  applied = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  state = applied.state;
  connection = applied.connection;
  assert.equal(api.tasks.get(rid)!.title, 'Новый шаг');
  assert.equal(api.tasks.get(rid)!.priority, 5);
  api.tasks.set(rid, {
    ...api.tasks.get(rid)!,
    title: 'Изменено в TickTick',
    dueDate: '2027-03-01T12:00:00+0000',
  });
  applied = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  state = applied.state;
  connection = applied.connection;
  assert.equal(state.quests[0].name, 'Изменено в TickTick');
  assert.equal(state.quests[0].dueAt, '2027-03-01T12:00:00.000Z');
  api.tasks.get(rid)!.status = 2;
  applied = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  state = applied.state;
  connection = applied.connection;
  assert.equal(state.xp, 2470);
  assert.equal(state.completed, 1);
  assert.equal(state.quests[0].done, true);
  api.tasks.get(rid)!.status = 0;
  applied = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  assert.equal(applied.state.xp, 2470);
  assert.equal(api.tasks.get(rid)!.status, 2);
  assert.equal(applied.state.completed, 1);
});
test('новая активная задача TickTick импортируется один раз в выбранную сферу', async () => {
  let { state, connection } = setup();
  state.quests = [];
  connection.sphereId = 'sport';
  const api = upstream([remote('new')]);
  let result = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  assert.equal(result.state.quests.length, 1);
  assert.equal(result.state.quests[0].sphere, 'sport');
  assert.equal(result.state.quests[0].xp, 20);
  assert.equal(result.state.xp, state.xp);
  state = result.state;
  connection = result.connection;
  result = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  assert.equal(result.state.quests.length, 1);
  assert.equal(api.calls.filter((c) => c.path === '/create').length, 0);
});
test('одновременная правка сохраняет локальный план, подтверждённое выполнение выигрывает', async () => {
  let { state, connection } = setup();
  const api = upstream();
  let applied = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  state = applied.state;
  connection = applied.connection;
  const rid = connection.links[state.quests[0].id].remoteId;
  state = saveTask(state, { ...state.quests[0], name: 'Локальная правка' });
  api.tasks.get(rid)!.title = 'Удалённая правка';
  api.tasks.get(rid)!.status = 2;
  applied = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  assert.equal(applied.state.quests[0].name, 'Локальная правка');
  assert.equal(applied.state.quests[0].done, true);
  assert.equal(applied.state.xp, state.xp + 20);
  assert.equal(applied.warnings.length, 1);
});
test('недоступная удалённая задача не считается выполненной или удалённой', async () => {
  let { state, connection } = setup();
  const api = upstream();
  let result = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  state = result.state;
  connection = result.connection;
  api.tasks.clear();
  result = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  assert.equal(result.state.quests.length, 1);
  assert.equal(result.state.quests[0].done, false);
  assert.equal(result.state.xp, state.xp);
  assert.equal(result.warnings.length, 1);
  assert.equal(api.calls.filter((c) => c.path === '/create').length, 1);
});
test('локальное удаление сохраняет TickTick по умолчанию и не импортирует задачу обратно', async () => {
  let { state, connection } = setup();
  const api = upstream();
  let result = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  state = removeQuest(result.state, state.quests[0].id);
  connection = result.connection;
  result = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  assert.equal(result.state.quests.length, 0);
  assert.equal(api.tasks.size, 1);
  assert.equal(result.connection.dismissed.length, 1);
  const repeated = applyTickTickResult(
    result.state,
    await syncTickTick(result.state, result.connection, api.request),
  );
  assert.equal(repeated.state.quests.length, 0);
});
test('удаление в TickTick работает только для связанной задачи при включённой настройке', async () => {
  let { state, connection } = setup();
  const api = upstream();
  const first = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  connection = { ...first.connection, deleteRemote: true };
  state = removeQuest(first.state, state.quests[0].id);
  await syncTickTick(state, connection, api.request);
  assert.equal(api.tasks.size, 0);
  assert.equal(api.calls.filter((c) => c.method === 'DELETE').length, 1);
});
test('изменённый во время запроса текст не затирается ответом TickTick', async () => {
  let { state, connection } = setup();
  const api = upstream();
  let first = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  state = first.state;
  connection = first.connection;
  const rid = connection.links[state.quests[0].id].remoteId;
  api.tasks.get(rid)!.title = 'Старый ответ сервера';
  const result = await syncTickTick(state, connection, api.request);
  const edited = saveTask(state, {
    ...state.quests[0],
    name: 'Новейшая правка',
  });
  first = applyTickTickResult(edited, result);
  assert.equal(first.state.quests[0].name, 'Новейшая правка');
  assert.equal(first.state.xp, state.xp);
});
test('выполнение TickTick двигает цель, даты вне её срока отклоняются', async () => {
  let { state, connection } = setup();
  state.quests = [];
  state = saveGoal(state, {
    name: 'Короткая цель',
    sphere: 'english',
    target: 100,
    reward: 100,
    progressMode: 'tasks',
    startsAt: '2027-03-01T00:00:00.000Z',
    dueAt: '2027-03-02T00:00:00.000Z',
  });
  const goal = state.goals.at(-1)!;
  state = saveTask(state, {
    name: 'Шаг',
    sphere: 'english',
    difficulty: 'Medium',
    goalId: goal.id,
    startsAt: '2027-03-01T09:00:00.000Z',
    dueAt: '2027-03-01T10:00:00.000Z',
  });
  const api = upstream();
  let result = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  state = result.state;
  connection = result.connection;
  const rid = connection.links[state.quests[0].id].remoteId;
  api.tasks.get(rid)!.dueDate = '2027-03-03T00:00:00+0000';
  result = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  assert.equal(result.state.quests[0].dueAt, state.quests[0].dueAt);
  assert.equal(result.warnings.length, 1);
  api.tasks.get(rid)!.dueDate = '2027-03-01T10:00:00+0000';
  api.tasks.get(rid)!.status = 2;
  result = applyTickTickResult(
    result.state,
    await syncTickTick(result.state, result.connection, api.request),
  );
  assert.equal(result.state.goals.at(-1)!.current, 100);
  assert.equal(result.state.xp - state.xp, 120);
});

test('удаление уже недоступной задачи не блокирует остальные задачи', async () => {
  let { state, connection } = setup();
  const api = upstream();
  const first = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  state = removeQuest(first.state, state.quests[0].id);
  connection = { ...first.connection, deleteRemote: true };
  api.tasks.clear();
  const result = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  assert.equal(Object.keys(result.connection.links).length, 0);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.state.xp, state.xp);
});

test('история выполненных задач не создаёт отдельные запросы при каждом обновлении', async () => {
  let { state, connection } = setup();
  const api = upstream();
  let applied = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  state = applied.state;
  connection = applied.connection;
  api.tasks.get(connection.links[state.quests[0].id].remoteId)!.status = 2;
  applied = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  const before = api.calls.length;
  await syncTickTick(applied.state, applied.connection, api.request);
  assert.equal(api.calls.length - before, 1);
  assert.equal(api.calls.at(-1)!.path, '/api/project/life/data');
});
