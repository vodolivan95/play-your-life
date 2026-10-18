import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/game.ts';
import type { GameState } from '../src/game.ts';
import { saveGoal, saveStage } from '../src/planning.ts';
import {
  applyTickTickResult,
  newConnection,
  syncTickTick,
} from '../src/ticktick.ts';
import type { RemoteTask } from '../src/ticktick.ts';
import {
  acceptIncomingTask,
  incomingForToday,
  dismissIncomingTask,
  findIncomingTasks,
  inboxHorizon,
  goalsForSphere,
  openStages,
} from '../src/ticktickInbox.ts';

function setup() {
  let state = initialState();
  state.profile = {
    ...state.profile,
    mode: 'personal',
    onboardingComplete: true,
  };
  state.quests = [];
  state.goals = [];
  state = saveGoal(state, {
    name: 'Разговорный английский',
    sphere: 'english',
    target: 100,
    reward: 100,
    progressMode: 'tasks',
  });
  const enId = state.goals[0].id;
  state = saveStage(state, enId, { name: 'Первый месяц' });
  const stageId = state.goals[0].stages![0].id;
  state = saveGoal(state, {
    name: 'Марафон',
    sphere: 'sport',
    target: 100,
    reward: 100,
    progressMode: 'tasks',
  });
  const sportId = state.goals.find((g) => g.name === 'Марафон')!.id;
  const connection = newConnection('https://bridge.example/');
  connection.sphereLists = { english: 'life', sport: 'run' };
  return { state, connection, stageId, enId, sportId };
}
const remote = (
  id: string,
  extra: Partial<RemoteTask> = {},
  projectId = 'life',
): RemoteTask => ({
  id,
  projectId,
  title: `Задача ${id}`,
  content: 'Заметка из TickTick',
  priority: 3,
  status: 0,
  ...extra,
});
// Имитация сервера TickTick: список задач, обновление и выполнение.
function bridge(initial: RemoteTask[]) {
  const tasks = new Map(initial.map((t) => [t.id, { ...t }]));
  const calls: { path: string; method: string; body?: unknown }[] = [];
  async function request<T>(
    path: string,
    method = 'GET',
    body?: unknown,
  ): Promise<T> {
    calls.push({ path, method, body });
    const parts = path.split('/');
    if (/^\/api\/project\/[^/]+\/data$/.test(path))
      return structuredClone({
        tasks: [...tasks.values()].filter(
          (t) => t.status !== 2 && t.projectId === parts[3],
        ),
      }) as T;
    if (path === '/create') throw new Error('Копия не должна создаваться.');
    if (/^\/api\/task\/[^/]+$/.test(path) && method === 'POST') {
      const id = parts.at(-1)!;
      const task = { ...tasks.get(id), ...(body as object) } as RemoteTask;
      tasks.set(id, task);
      return structuredClone(task) as T;
    }
    if (path.endsWith('/complete')) {
      tasks.get(parts.at(-2)!)!.status = 2;
      return null as T;
    }
    return structuredClone(tasks.get(parts.at(-1)!)) as T;
  }
  return { request, tasks, calls };
}
const byProject = (list: RemoteTask[]) => {
  const out: Record<string, RemoteTask[]> = {};
  for (const task of list) (out[task.projectId] ??= []).push(task);
  return out;
};

test('входящие: только новые активные задачи сопоставленных списков', () => {
  const { connection } = setup();
  connection.links = {
    'local-1': { remoteId: 'linked', local: 'a', remote: 'b' },
  };
  connection.dismissed = ['hidden'];
  const found = findIncomingTasks(
    connection,
    byProject([
      remote('new-1'),
      remote('linked'),
      remote('hidden'),
      remote('done', { status: 2 }),
      remote('mine', { content: 'Цель: X\n[PYL:abc]' }),
      remote('blank', { title: '   ' }),
      remote('bad id!'),
      remote('run-1', {}, 'run'),
      remote('other-list', {}, 'unmapped'),
    ]),
  );
  assert.deepEqual(
    found.map((item) => [item.remote.id, item.sphere, item.projectId]),
    // Порядок задан порядком сфер в игре: «Спорт» идёт раньше «Английского».
    [
      ['run-1', 'sport', 'run'],
      ['new-1', 'english', 'life'],
    ],
  );
});

test('входящие: задача из списка, привязанного к двум сферам, показывается один раз', () => {
  const { connection } = setup();
  connection.sphereLists = { english: 'life', growth: 'life' };
  const found = findIncomingTasks(connection, byProject([remote('same')]));
  assert.equal(found.length, 1);
});

test('выбор сферы, цели и этапа: задача создаётся в цели, связь и XP корректны', () => {
  const { state, connection, stageId, enId } = setup();
  const incoming = findIncomingTasks(connection, byProject([remote('t1')]))[0];
  const accepted = acceptIncomingTask(
    state,
    connection,
    incoming,
    { sphere: 'english', goalId: enId, stageId },
    'task-1',
  );
  assert.equal(accepted.state.xp, state.xp);
  assert.equal(accepted.task.id, 'task-1');
  assert.equal(accepted.task.name, 'Задача t1');
  assert.equal(accepted.task.sphere, 'english');
  assert.equal(accepted.task.goalId, enId);
  assert.equal(accepted.task.stageId, stageId);
  assert.equal(accepted.task.notes, 'Заметка из TickTick');
  assert.equal(accepted.connection.links['task-1'].remoteId, 't1');
  assert.equal(accepted.connection.links['task-1'].projectId, 'life');
  assert.equal(accepted.connection.links['task-1'].goalId, enId);
  const update = accepted.remoteUpdate as { content: string; id: string };
  assert.equal(update.id, 't1');
  assert.match(update.content, /^Заметка из TickTick\n\n— PLAY YOUR LIFE —/);
  assert.match(update.content, /Цель: Разговорный английский/);
  assert.match(update.content, /Этап: Первый месяц/);
  assert.match(update.content, /\[PYL:task-1\]$/);
  // Исходное состояние не изменено.
  assert.equal(state.quests.length, 0);
  assert.equal(connection.links['task-1'], undefined);
});

test('сфера задачи определяется целью: можно принять в другую сферу, чем у списка', () => {
  const { state, connection, sportId } = setup();
  const incoming = findIncomingTasks(connection, byProject([remote('t2')]))[0];
  const accepted = acceptIncomingTask(
    state,
    connection,
    incoming,
    { sphere: 'sport', goalId: sportId },
    'task-2',
  );
  assert.equal(accepted.task.sphere, 'sport');
  assert.equal(accepted.task.stageId, undefined);
  // Связь остаётся со списком, где задача лежит в TickTick.
  assert.equal(accepted.connection.links['task-2'].projectId, 'life');
});

test('одиночная задача без цели: в игре есть и связана с TickTick', () => {
  const { state, connection } = setup();
  const incoming = findIncomingTasks(connection, byProject([remote('s1')]))[0];
  const accepted = acceptIncomingTask(state, connection, incoming, { sphere: 'english', goalId: '' }, 'single-1');
  assert.equal(accepted.task.goalId, undefined);
  assert.equal(accepted.task.sphere, 'english');
  assert.notEqual(accepted.task.tickTickSync, false);
  assert.equal((accepted.remoteUpdate as { id: string }).id, 's1');
  assert.equal(accepted.connection.links['single-1'].remoteId, 's1');
  assert.equal(findIncomingTasks(accepted.connection, byProject([remote('s1')])).length, 0);
});
test('входящие на сегодня: срок сегодня или раньше, без даты не считаются', () => {
  const { connection } = setup();
  const now = new Date('2026-10-18T12:00:00');
  const items = findIncomingTasks(connection, byProject([
    remote('d0', { dueDate: '2026-10-18T09:00:00+0300' }),
    remote('d-', { dueDate: '2026-10-10T09:00:00+0300' }),
    remote('d+', { dueDate: '2026-10-25T09:00:00+0300' }),
    remote('d?', {}),
  ]), now);
  assert.deepEqual(incomingForToday(items, now).map((i) => i.remote.id).sort(), ['d-', 'd0']);
});
test('ошибки выбора не меняют состояние', () => {
  const { state, connection, enId } = setup();
  const incoming = findIncomingTasks(connection, byProject([remote('t3')]))[0];
  assert.throws(
    () =>
      acceptIncomingTask(state, connection, incoming, {
        sphere: 'english',
        goalId: 'нет-такой-цели',
      }),
    /цель/i,
  );
  assert.throws(
    () =>
      acceptIncomingTask(state, connection, incoming, {
        sphere: 'sport',
        goalId: enId,
      }),
    /другой сфере/,
  );
  assert.throws(
    () =>
      acceptIncomingTask(state, connection, incoming, {
        sphere: 'english',
        goalId: enId,
        stageId: 'missing',
      }),
    /Этап не найден/,
  );
  assert.equal(state.quests.length, 0);
});

test('сроки задачи из TickTick проверяются по сроку цели', () => {
  const prepared = setup();
  const { connection, enId } = prepared;
  let state = prepared.state;
  state = saveGoal(state, {
    ...state.goals.find((g) => g.id === enId)!,
    startsAt: '2027-01-01T00:00:00.000Z',
    dueAt: '2027-02-01T00:00:00.000Z',
  });
  const incoming = findIncomingTasks(
    connection,
    byProject([remote('late', { dueDate: '2027-06-01T10:00:00+0000' })]),
    new Date('2027-03-01T00:00:00Z'),
  )[0];
  assert.throws(
    () =>
      acceptIncomingTask(state, connection, incoming, {
        sphere: 'english',
        goalId: enId,
      }),
    /срок цели/,
  );
  const ok = findIncomingTasks(
    connection,
    byProject([remote('fit', { dueDate: '2027-01-15T10:00:00+0000' })]),
    new Date('2027-03-01T00:00:00Z'),
  )[0];
  const accepted = acceptIncomingTask(state, connection, ok, {
    sphere: 'english',
    goalId: enId,
  });
  assert.equal(accepted.task.dueAt, '2027-01-15T10:00:00.000Z');
});

test('длинное название обрезается до 100 символов', () => {
  const { state, connection, enId } = setup();
  const long = findIncomingTasks(
    connection,
    byProject([remote('long', { title: 'я'.repeat(150) })]),
  )[0];
  const accepted = acceptIncomingTask(state, connection, long, {
    sphere: 'english',
    goalId: enId,
  });
  assert.equal(accepted.task.name.length, 100);
});

test('после приёма обмен не создаёт копию и ничего не меняет; выполнение даёт XP один раз', async () => {
  const { state, connection, stageId, enId } = setup();
  const api = bridge([remote('t4')]);
  const incoming = findIncomingTasks(
    connection,
    byProject([...api.tasks.values()]),
  )[0];
  const accepted = acceptIncomingTask(
    state,
    connection,
    incoming,
    { sphere: 'english', goalId: enId, stageId },
    'task-4',
  );
  // Как в приложении: метка и цель с этапом записываются в TickTick до сохранения связи.
  await api.request(
    '/api/task/t4',
    'POST',
    accepted.remoteUpdate,
  );
  assert.match(api.tasks.get('t4')!.content!, /\[PYL:task-4\]/);
  let game: GameState = accepted.state;
  let link = accepted.connection;
  api.calls.length = 0;
  let result = applyTickTickResult(
    game,
    await syncTickTick(game, link, api.request),
  );
  game = result.state;
  link = result.connection;
  assert.equal(api.calls.filter((c) => c.method !== 'GET').length, 0);
  assert.equal(result.warnings.length, 0);
  assert.equal(game.quests.length, 1);
  // После приёма задача больше не предлагается как входящая.
  assert.equal(
    findIncomingTasks(link, byProject([...api.tasks.values()])).length,
    0,
  );
  // Выполнение в TickTick засчитывается один раз.
  const before = game.xp;
  api.tasks.get('t4')!.status = 2;
  result = applyTickTickResult(
    game,
    await syncTickTick(game, link, api.request),
  );
  game = result.state;
  link = result.connection;
  assert.equal(game.quests[0].done, true);
  assert.ok(game.xp > before);
  const after = game.xp;
  result = applyTickTickResult(
    game,
    await syncTickTick(game, link, api.request),
  );
  assert.equal(result.state.xp, after);
});

test('пропущенная задача больше не появляется', () => {
  const { connection } = setup();
  const list = byProject([remote('skip-me'), remote('keep')]);
  const next = dismissIncomingTask(connection, 'skip-me');
  assert.deepEqual(
    findIncomingTasks(next, list).map((i) => i.remote.id),
    ['keep'],
  );
  // Повторное пропускание не плодит записи, список ограничен.
  assert.equal(dismissIncomingTask(next, 'skip-me').dismissed.length, 1);
  const many = { ...connection, dismissed: Array.from({ length: 2000 }, (_, i) => `d${i}`) };
  const capped = dismissIncomingTask(many, 'fresh');
  assert.equal(capped.dismissed.length, 2000);
  assert.equal(capped.dismissed.at(-1), 'fresh');
});

test('выбор целей и этапов: только незавершённые', () => {
  const { state, stageId, enId } = setup();
  assert.deepEqual(
    goalsForSphere(state, 'english').map((g) => g.id),
    [enId],
  );
  assert.deepEqual(goalsForSphere(state, 'health'), []);
  assert.deepEqual(
    openStages(state.goals.find((g) => g.id === enId)).map((s) => s.id),
    [stageId],
  );
  assert.deepEqual(openStages(undefined), []);
});

test('входящие: берутся задачи на ближайшие 4 месяца, далёкое будущее не подтягивается', () => {
  const { connection } = setup();
  const now = new Date('2026-10-18T10:00:00Z');
  assert.equal(inboxHorizon(now).toISOString().slice(0, 10), '2027-02-18');
  const found = findIncomingTasks(
    connection,
    byProject([
      remote('no-date'),
      remote('overdue', { dueDate: '2026-09-01T09:00:00+0000' }),
      remote('near', { dueDate: '2027-02-10T09:00:00+0000' }),
      remote('far-due', { dueDate: '2027-06-01T09:00:00+0000' }),
      remote('far-start', { startDate: '2028-01-05T09:00:00+0000' }),
      remote('start-near-due-far', { startDate: '2026-11-01T09:00:00+0000', dueDate: '2027-09-01T09:00:00+0000' }),
    ]),
    now,
  );
  assert.deepEqual(
    found.map((item) => item.remote.id).sort(),
    ['near', 'no-date', 'overdue'],
  );
});
