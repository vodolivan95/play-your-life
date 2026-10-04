import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, removeQuest } from '../src/game.ts';
import { saveGoal, saveTask } from '../src/planning.ts';
import {
  applyTickTickResult,
  newConnection,
  syncTickTick,
  matchSphereLists,
} from '../src/ticktick.ts';
import type { RemoteTask } from '../src/ticktick.ts';
function setup() {
  const state = initialState();
  state.profile = {
    ...state.profile,
    mode: 'personal',
    onboardingComplete: true,
  };
  state.quests = [{ ...state.quests[0], goalId: 'b2' }];
  const connection = newConnection('https://bridge.example/');
  connection.projectId = 'life';
  connection.sphereLists = { english: 'life' };
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
    if (/^\/api\/project\/[^/]+\/data$/.test(path))
      result = {
        tasks: [...tasks.values()].filter(
          (t) =>
            t.status !== 2 &&
            t.projectId === decodeURIComponent(path.split('/')[3]),
        ),
      };
    else if (path === '/create') {
      const id = `remote-${tasks.size + 1}`;
      const task = {
        ...payload,
        id,
        projectId: payload.projectId!,
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
      if (!task || task.projectId !== decodeURIComponent(path.split('/')[3]))
        throw new Error('Не найдено (404)');
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
test('посторонние задачи TickTick не импортируются и не изменяются', async () => {
  const { state, connection } = setup();
  state.quests = [];
  const api = upstream([remote('foreign')]);
  const result = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  assert.equal(result.state.quests.length, 0);
  assert.equal(Object.keys(result.connection.links).length, 0);
  assert.equal(api.calls.length, 0);
  assert.deepEqual(api.tasks.get('foreign'), remote('foreign'));
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

test('в TickTick создаются только новые подзадачи, а не цели, этапы и самостоятельные квесты', async () => {
  const { state, connection } = setup();
  state.quests.push({
    ...state.quests[0],
    id: 'standalone',
    name: 'Самостоятельный квест',
    goalId: undefined,
  });
  state.quests.push({
    ...state.quests[0],
    id: 'orphan',
    goalId: 'unknown-goal',
  });
  const api = upstream();
  const first = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  assert.equal(api.tasks.size, 1);
  assert.equal(api.calls.filter((c) => c.method === 'POST').length, 1);
  assert.equal(api.calls.find((c) => c.method === 'POST')!.path, '/create');
  const before = api.calls.length;
  const next = saveTask(first.state, {
    name: 'Новая подзадача',
    sphere: 'english',
    difficulty: 'Medium',
    goalId: 'b2',
  });
  const second = applyTickTickResult(
    next,
    await syncTickTick(next, first.connection, api.request),
  );
  assert.equal(api.tasks.size, 2);
  assert.equal(
    api.calls.slice(before).filter((c) => c.path === '/create').length,
    1,
  );
  assert.equal(second.state.goals.length, state.goals.length);
  assert.equal(
    api.calls.some((c) => c.method === 'POST' && c.path.includes('/project')),
    false,
  );
});

test('старые связи самостоятельных задач отключаются без изменения или удаления TickTick', async () => {
  const { state, connection } = setup();
  const api = upstream();
  const first = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  const converted = {
    ...first.state,
    quests: first.state.quests.map((q) => ({ ...q, goalId: undefined })),
  };
  const before = api.calls.length;
  const result = applyTickTickResult(
    converted,
    await syncTickTick(
      converted,
      { ...first.connection, deleteRemote: true },
      api.request,
    ),
  );
  assert.equal(api.tasks.size, 1);
  assert.equal(Object.keys(result.connection.links).length, 0);
  assert.equal(result.state.quests.length, 1);
  assert.equal(result.state.xp, state.xp);
  assert.equal(
    api.calls.slice(before).some((c) => c.method !== 'GET'),
    false,
  );
});

test('ответ TickTick не завершает задачу, отвязанную от цели во время запроса', async () => {
  const { state, connection } = setup();
  const api = upstream();
  const first = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  api.tasks.get(Object.values(first.connection.links)[0].remoteId)!.status = 2;
  const pending = await syncTickTick(
    first.state,
    first.connection,
    api.request,
  );
  const detached = {
    ...first.state,
    quests: first.state.quests.map((q) => ({ ...q, goalId: undefined })),
  };
  const result = applyTickTickResult(detached, pending);
  assert.equal(result.state.quests[0].done, false);
  assert.equal(result.state.xp, state.xp);
});

test('сопоставление по названиям учитывает эмодзи и регистр, сохраняет ручной выбор и пропускает неоднозначность', () => {
  const mappings = matchSphereLists(
    [
      { id: 'health-list', name: '❤️ ЗДОРОВЬЕ ' },
      { id: 'english-list', name: 'Английский' },
      { id: 'sport-1', name: 'Спорт' },
      { id: 'sport-2', name: '🏃 Спорт' },
    ],
    { english: 'manual-list', finance: '' },
  );
  assert.equal(mappings.health, 'health-list');
  assert.equal(mappings.english, 'manual-list');
  assert.equal(mappings.finance, '');
  assert.equal(mappings.sport, undefined);
  assert.equal(mappings.hobby, undefined);
});
function withHealthGoal(state: ReturnType<typeof initialState>) {
  let next = saveGoal(state, {
    name: 'Забота о здоровье',
    sphere: 'health',
    target: 100,
    reward: 200,
    progressMode: 'tasks',
  });
  const goalId = next.goals.at(-1)!.id;
  for (const name of ['Прогулка 30 минут', 'Утренняя зарядка'])
    next = saveTask(next, {
      name,
      sphere: 'health',
      difficulty: 'Medium',
      goalId,
    });
  return next;
}
test('подзадачи здоровья и английского попадают в свои списки, выполнение обновляет только нужную цель', async () => {
  const fixture = setup();
  let state = fixture.state;
  const connection = fixture.connection;
  state = withHealthGoal(state);
  connection.sphereLists = { health: 'health-list', english: 'english-list' };
  const api = upstream();
  let applied = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  const english = applied.state.quests.find((q) => q.sphere === 'english')!;
  const health = applied.state.quests.find((q) => q.sphere === 'health')!;
  assert.equal(
    api.tasks.get(applied.connection.links[english.id].remoteId)!.projectId,
    'english-list',
  );
  const healthRemote = applied.connection.links[health.id].remoteId;
  assert.equal(api.tasks.get(healthRemote)!.projectId, 'health-list');
  api.tasks.get(healthRemote)!.status = 2;
  const before = applied.state;
  applied = applyTickTickResult(
    applied.state,
    await syncTickTick(applied.state, applied.connection, api.request),
  );
  assert.equal(applied.state.goals.at(-1)!.current, 50);
  assert.equal(applied.state.spheres.health.xp - before.spheres.health.xp, 20);
  assert.equal(applied.state.spheres.english.xp, before.spheres.english.xp);
  assert.equal(
    applied.state.quests.find((q) => q.id === english.id)!.done,
    false,
  );
});
test('без сопоставления сферы новая задача не отправляется в старый общий список', async () => {
  const fixture = setup();
  let state = fixture.state;
  const connection = fixture.connection;
  state = withHealthGoal(state);
  connection.sphereLists = { health: 'health-list' };
  const api = upstream();
  const result = await syncTickTick(state, connection, api.request);
  assert.equal(api.tasks.size, 2);
  assert.ok(
    [...api.tasks.values()].every((q) => q.projectId === 'health-list'),
  );
  assert.equal(result.warnings.length, 1);
  assert.equal(
    Object.keys(result.connection.links).some((id) => id === 'english-1'),
    false,
  );
  assert.equal(
    api.calls.some((c) => c.path.includes('/life/')),
    false,
  );
});
test('сферы могут использовать один существующий список без повторных запросов и дублей', async () => {
  const fixture = setup();
  let state = fixture.state;
  const connection = fixture.connection;
  state = withHealthGoal(state);
  connection.sphereLists = { english: 'shared', health: 'shared' };
  const api = upstream();
  let result = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  assert.equal(api.tasks.size, 3);
  assert.equal(
    api.calls.filter((c) => c.path === '/api/project/shared/data').length,
    1,
  );
  result = applyTickTickResult(
    result.state,
    await syncTickTick(result.state, result.connection, api.request),
  );
  assert.equal(api.tasks.size, 3);
  assert.equal(Object.keys(result.connection.links).length, 3);
});
test('смена сопоставления направляет новые подзадачи в новый список и сохраняет старые связи', async () => {
  const { state, connection } = setup();
  const api = upstream();
  const first = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  const next = saveTask(first.state, {
    name: 'Новая подзадача английского',
    sphere: 'english',
    difficulty: 'Medium',
    goalId: 'b2',
  });
  const result = applyTickTickResult(
    next,
    await syncTickTick(
      next,
      { ...first.connection, sphereLists: { english: 'new-english' } },
      api.request,
    ),
  );
  assert.equal(result.connection.links['english-1'].projectId, 'life');
  assert.equal(api.tasks.size, 2);
  assert.equal(
    api.tasks.get(result.connection.links[next.quests.at(-1)!.id].remoteId)!
      .projectId,
    'new-english',
  );
});
test('старые сохранённые связи читаются из прежнего списка без создания новых задач', async () => {
  const { state, connection } = setup();
  const api = upstream();
  const first = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  const legacy = structuredClone(first.connection);
  delete legacy.sphereLists;
  for (const link of Object.values(legacy.links)) delete link.projectId;
  const remoteId = legacy.links['english-1'].remoteId;
  api.tasks.get(remoteId)!.status = 2;
  const result = applyTickTickResult(
    first.state,
    await syncTickTick(first.state, legacy, api.request),
  );
  assert.equal(result.state.quests[0].done, true);
  assert.equal(result.connection.links['english-1'].projectId, 'life');
  assert.equal(api.tasks.size, 1);
});
test('ошибка одного списка не мешает отправке задач в другой', async () => {
  const fixture = setup();
  let state = fixture.state;
  const connection = fixture.connection;
  state = withHealthGoal(state);
  connection.sphereLists = { english: 'life', health: 'health-list' };
  const api = upstream();
  const request = async <T>(
    path: string,
    method?: string,
    body?: unknown,
  ): Promise<T> => {
    if (path === '/api/project/life/data') throw new Error('Список недоступен');
    return api.request<T>(path, method, body);
  };
  const result = await syncTickTick(state, connection, request);
  assert.equal(api.tasks.size, 2);
  assert.equal(Object.keys(result.connection.links).length, 2);
  assert.equal(result.warnings.length, 1);
});

test('названия списков с фотографии сопоставляют девять сфер, английский предпочитает «Английский язык», работа остаётся отдельно', () => {
  const names = [
    'Здоровье',
    'Спорт',
    'Саморазвитие',
    'Английский язык',
    'Финансы',
    'Работа',
    'Совместные задачи',
    'Вождение',
    'Задачи',
    'Досуг и хобби',
  ];
  const projects = names.map((name, i) => ({ id: `list-${i}`, name }));
  projects.push({ id: 'legacy-english', name: 'Английский' });
  const mapping = matchSphereLists(projects);
  assert.equal(Object.keys(mapping).length, 9);
  assert.equal(mapping.english, 'list-3');
  assert.equal(mapping.health, 'list-0');
  assert.equal(Object.values(mapping).includes('list-5'), false);
});

test('передача выбранной конкретной задачи не создаёт другие задачи той же цели или списка', async () => {
  const { state, connection } = setup();
  state.goals.find((g) => g.id === 'b2')!.stages = [
    { id: 'listening', name: '100 часов аудирования' },
  ];
  state.quests[0] = {
    ...state.quests[0],
    stageId: 'listening',
    name: 'Аудирование 1 час',
    startsAt: '2026-10-04T11:00:00Z',
    dueAt: '2026-10-04T12:00:00Z',
  };
  state.quests.push({
    ...state.quests[0],
    id: 'other',
    name: 'Другой конкретный шаг',
  });
  const api = upstream();
  const result = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request, [state.quests[0].id]),
  );
  assert.equal(api.tasks.size, 1);
  const task = [...api.tasks.values()][0];
  assert.equal(task.title, 'Аудирование 1 час');
  assert.match(task.content!, /Этап: 100 часов аудирования/);
  assert.equal(task.startDate, '2026-10-04T11:00:00+0000');
  assert.equal(task.dueDate, '2026-10-04T12:00:00+0000');
  assert.equal(result.connection.links.other, undefined);
  assert.equal(result.state.xp, state.xp);
  await syncTickTick(result.state, result.connection, api.request, [
    state.quests[0].id,
  ]);
  assert.equal(api.tasks.size, 1);
});
test('ограниченная передача сохраняет связи остальных задач и пустой выбор ничего не отправляет', async () => {
  const { state, connection } = setup();
  state.quests.push({
    ...state.quests[0],
    id: 'second',
    name: 'Вторая задача',
  });
  const api = upstream();
  const first = applyTickTickResult(
    state,
    await syncTickTick(state, connection, api.request),
  );
  const before = structuredClone(first.connection.links.second);
  const result = await syncTickTick(
    first.state,
    first.connection,
    api.request,
    [state.quests[0].id],
  );
  assert.deepEqual(result.connection.links.second, before);
  const calls = api.calls.length;
  await syncTickTick(state, connection, api.request, []);
  assert.equal(api.calls.length, calls);
});
