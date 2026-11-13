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
  findTickTickCalendarTasks,
  formatIncomingDate,
  incomingForScope,
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

test('копия задачи в TickTick с той же меткой [PYL] показывается как новая задача', () => {
  const { connection } = setup();
  connection.links = { 'task-a': { remoteId: 'original', local: 'a', remote: 'b' } };
  const dated = { dueDate: '2026-11-10T13:00:00.000+0000' };
  const tasks = byProject([
    // Связанная задача и её копия с новым названием: TickTick экранирует скобки метки.
    remote('original', { ...dated, content: 'x\n\\[PYL:task-a\\]' }),
    remote('copy-of-linked', { ...dated, title: 'Новое название', content: 'x\n\\[PYL:task-a\\]' }),
    // Две несвязанные копии одной метки — обе новые.
    remote('twin-1', { ...dated, content: '[PYL:task-b]' }),
    remote('twin-2', { ...dated, content: '[PYL:task-b]' }),
    // Единственная несвязанная задача с меткой существующей игровой задачи — связь восстановит сервер.
    remote('pending', { ...dated, content: '[PYL:task-c]' }),
    // Метка задачи, которой в игре уже нет, — новая задача.
    remote('orphan', { ...dated, content: '[PYL:task-gone]' }),
  ]);
  const local = new Set(['task-a', 'task-b', 'task-c']);
  const expected = ['copy-of-linked', 'twin-1', 'twin-2', 'orphan'];
  assert.deepEqual(findIncomingTasks(connection, tasks, local).map((item) => item.remote.id), expected);
  assert.deepEqual(findIncomingTasks(connection, tasks, local).filter((item) => item.possibleDuplicate).map((item) => item.remote.id), ['twin-1', 'twin-2']);
  assert.deepEqual(findTickTickCalendarTasks(connection, tasks, local).map((item) => item.remote.id), ['copy-of-linked', 'orphan']);
  // Без списка игровых задач «осиротевшая» метка по-прежнему считается своей.
  assert.deepEqual(findIncomingTasks(connection, tasks).map((item) => item.remote.id), expected.slice(0, 3));
});

test('копия с изменённым названием или описанием становится новой, совпадающее содержание помечается возможным дублем', () => {
  const { connection } = setup();
  connection.links = { 'english-1': { remoteId: 'english-original', local: 'a', remote: 'b' } };
  const original = remote('english-original', {
    title: 'Заниматься английским',
    content: 'Puzzle English, урок 12\n\n— PLAY YOUR LIFE —\n[PYL:english-1]',
    dueDate: '2026-11-12T16:00:00+0300',
  });
  const changedName = {
    ...original,
    id: 'copy-name',
    title: 'Английский: speaking',
    content: 'Puzzle English, урок 12\n\n— PLAY YOUR LIFE —\n[PYL:english-1]',
    dueDate: '2026-11-14T16:00:00+0300',
  };
  const changedNotes = {
    ...original,
    id: 'copy-notes',
    content: 'Puzzle English, разговорная практика\n\n— PLAY YOUR LIFE —\n[PYL:english-1]',
    dueDate: '2026-11-15T16:00:00+0300',
  };
  const sameContentDifferentDate = {
    ...original,
    id: 'copy-same',
    dueDate: '2026-11-16T16:00:00+0300',
  };
  const tasks = byProject([original, changedName, changedNotes, sameContentDifferentDate]);
  const incoming = findIncomingTasks(connection, tasks, new Map([
    ['english-1', { name: 'Заниматься английским', notes: 'Puzzle English, урок 12' }],
  ]));
  assert.deepEqual(incoming.map((item) => [item.remote.id, item.possibleDuplicate]), [
    ['copy-name', undefined],
    ['copy-notes', undefined],
    ['copy-same', true],
  ]);
  assert.deepEqual(findTickTickCalendarTasks(connection, tasks).map((item) => item.remote.id), ['copy-name', 'copy-notes']);
});

test('совпадающие заголовки и пользовательские заметки — возможные дубли даже с разными PYL ID и вложениями', () => {
  const { connection } = setup();
  const a = remote('lesson-a', {
    title: 'Английский: занятие',
    dueDate: '2026-11-14T18:00:00+0300',
    content: '![image](attachment-a.jpg)\n— PLAY YOUR LIFE —\nЦель: Английский\n\\[PYL:old-task-a\\]',
  });
  const b = remote('lesson-b', {
    title: 'Английский: занятие',
    dueDate: '2026-11-15T18:00:00+0300',
    content: '![image](attachment-b.jpg)\n— PLAY YOUR LIFE —\nЦель: Английский\n\\[PYL:old-task-b\\]',
  });
  const tasks = byProject([a, b]);
  const incoming = findIncomingTasks(connection, tasks, new Map());
  assert.deepEqual(incoming.map((item) => [item.remote.id, item.possibleDuplicate]), [
    ['lesson-a', true],
    ['lesson-b', true],
  ]);
  assert.deepEqual(findTickTickCalendarTasks(connection, tasks).map((item) => item.remote.id), []);
});

test('копия со своей сохранённой связью не скрывается, если исходника нет в активном ответе TickTick', () => {
  const { connection } = setup();
  connection.links = {
    'english-source': {
      remoteId: 'source-not-in-list',
      local: 'local snapshot',
      remote: JSON.stringify(['Английский', 'Puzzle English, урок 12']),
    },
  };
  const copy = remote('copy', {
    title: 'Английский',
    content: 'Puzzle English, урок 12\n— PLAY YOUR LIFE —\n[PYL:english-source]',
    dueDate: '2026-11-20T18:00:00+0300',
  });
  const found = findIncomingTasks(connection, byProject([copy]), new Map([
    ['english-source', { name: 'Английский', notes: 'Puzzle English, урок 12' }],
  ]));
  assert.deepEqual(found.map((item) => [item.remote.id, item.possibleDuplicate]), [['copy', true]]);
});

test('изменённая относительно собственного оригинала задача не помечается дублем по совпадению с другой задачей', () => {
  const { connection } = setup();
  connection.links = {
    'english-source': {
      remoteId: 'source',
      local: 'local snapshot',
      remote: JSON.stringify(['Старый заголовок', 'Старые заметки']),
    },
  };
  const edited = remote('edited', {
    title: 'Английский: разговорная практика',
    content: 'Практика speaking\n— PLAY YOUR LIFE —\n[PYL:english-source]',
  });
  const peer = remote('peer', {
    title: 'Английский: разговорная практика',
    content: 'Практика speaking',
  });
  const found = findIncomingTasks(connection, byProject([edited, peer]), new Map([
    ['english-source', { name: 'Старый заголовок', notes: 'Старые заметки' }],
  ]));
  assert.deepEqual(found.map((item) => [item.remote.id, item.possibleDuplicate]), [
    ['edited', undefined],
    ['peer', true],
  ]);
});

test('регулярная задача TickTick не попадает во входящие как новая, но остаётся в календаре одним событием', () => {
  const { connection } = setup();
  const recurring = remote('weekly-english', {
    title: 'Английский по расписанию',
    repeatFlag: 'RRULE:FREQ=WEEKLY;BYDAY=TU,TH',
    dueDate: '2026-11-17T16:00:00+0300',
  });
  const tasks = byProject([recurring]);
  assert.deepEqual(findIncomingTasks(connection, tasks), []);
  assert.deepEqual(findTickTickCalendarTasks(connection, tasks).map((item) => item.remote.id), ['weekly-english']);
});

test('копия повторяющейся задачи с изменённым содержанием остаётся новой задачей', () => {
  const { connection } = setup();
  connection.links = { 'english-series': { remoteId: 'series', local: 'a', remote: 'b' } };
  const source = remote('series', {
    title: 'Английский',
    content: 'Puzzle English\n\n— PLAY YOUR LIFE —\n[PYL:english-series]',
    repeatFlag: 'RRULE:FREQ=WEEKLY;BYDAY=TU,TH',
  });
  const copiedAndEdited = {
    ...source,
    id: 'series-copy',
    title: 'Английский: разговорная практика',
    content: 'Практика speaking\n\n— PLAY YOUR LIFE —\n[PYL:english-series]',
    dueDate: '2026-11-20T16:00:00+0300',
  };
  const tasksWithCopy = byProject([source, copiedAndEdited]);
  const incoming = findIncomingTasks(connection, tasksWithCopy, new Map([
    ['english-series', { name: 'Английский', notes: 'Puzzle English' }],
  ]));
  assert.deepEqual(incoming.map((item) => item.remote.id), ['series-copy']);
});
test('входящие: задача из списка, привязанного к двум сферам, показывается один раз', () => {
  const { connection } = setup();
  connection.sphereLists = { english: 'life', growth: 'life' };
  const found = findIncomingTasks(connection, byProject([remote('same')]));
  assert.equal(found.length, 1);
});

test('календарь TickTick включает дальние датированные записи, но не связанные и бездаты', () => {
  const { connection } = setup();
  connection.links = { 'local-1': { remoteId: 'linked', local: 'a', remote: 'b' } };
  connection.dismissed = ['dismissed'];
  const tasks = byProject([
    remote('far', { dueDate: '2031-01-01' }),
    remote('completed', { dueDate: '2031-01-02', status: 2 }),
    remote('linked', { dueDate: '2031-01-03' }),
    remote('dismissed', { dueDate: '2031-01-04' }),
    remote('undated'),
  ]);
  assert.equal(findIncomingTasks(connection, tasks).some((item) => item.remote.id === 'far'), true, 'далёкая задача доступна для разбора во входящих');
  assert.deepEqual(findTickTickCalendarTasks(connection, tasks).map((item) => item.remote.id), ['far', 'completed', 'dismissed']);
});

test('входящие в scope: фильтр использует список сферы, а не подсказку item.sphere', () => {
  const { connection } = setup();
  // Один список может быть сознательно назначен нескольким сферам. Задача была
  // найдена первой для «Спорта», но должна быть доступна и при разборе «Английского».
  connection.sphereLists = {
    english: 'shared-list',
    sport: 'shared-list',
    health: 'health-list',
  };
  const incoming = [
    { remote: remote('shared', {}, 'shared-list'), projectId: 'shared-list', sphere: 'sport' },
    { remote: remote('health', {}, 'health-list'), projectId: 'health-list', sphere: 'health' },
    { remote: remote('outside', {}, 'other-list'), projectId: 'other-list', sphere: 'growth' },
  ];

  // Обычные входящие не фильтруются.
  assert.deepEqual(incomingForScope(incoming, connection).map((item) => item.remote.id), [
    'shared',
    'health',
    'outside',
  ]);
  assert.deepEqual(
    incomingForScope(incoming, connection, { sphereId: 'english' }).map((item) => [item.remote.id, item.sphere]),
    [['shared', 'sport']],
  );
  assert.deepEqual(
    incomingForScope(incoming, connection, { sphereId: 'health', goalId: 'goal-1', stageId: 'stage-1' }).map((item) => item.remote.id),
    ['health'],
  );
  assert.deepEqual(
    incomingForScope(incoming, connection, { sphereId: 'finance' }),
    [],
    'сфера без сопоставленного списка не показывает произвольные входящие',
  );
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
  assert.match(update.content, /Проект: Разговорный английский/);
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
test('входящие на сегодня: только точная дата, просрочка и задачи без даты не считаются', () => {
  const { connection } = setup();
  const now = new Date('2026-10-18T12:00:00');
  const items = findIncomingTasks(connection, byProject([
    remote('d0', { dueDate: '2026-10-18T09:00:00+0300' }),
    remote('d-', { dueDate: '2026-10-10T09:00:00+0300' }),
    remote('d+', { dueDate: '2026-10-25T09:00:00+0300' }),
    remote('d?', {}),
  ]), now);
  assert.deepEqual(incomingForToday(items, now).map((i) => i.remote.id).sort(), ['d0']);
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
    /проект/i,
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
    /срок проекта/,
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

test('приём задачи TickTick без цели не падает на «срок окончания раньше начала», когда startDate равен dueDate', () => {
  const { state, connection } = setup();
  const incoming = findIncomingTasks(
    connection,
    byProject([remote('same-day', {
      startDate: '2026-10-20T00:00:00+0000',
      dueDate: '2026-10-20T00:00:00+0000',
    })]),
    new Date('2026-10-19T00:00:00Z'),
  )[0];
  const accepted = acceptIncomingTask(state, connection, incoming, { sphere: 'health' });
  // Полночь без конкретного времени — это просто календарный день (см. ticktick.ts, iso()),
  // поэтому срок хранится обычной датой 'YYYY-MM-DD', а не моментом в UTC.
  assert.equal(accepted.task.dueAt, '2026-10-20');
  assert.equal(accepted.task.startsAt, undefined);
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

test('входящие: все новые активные задачи сопоставленных списков доступны независимо от даты', () => {
  const { connection } = setup();
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
  );
  assert.deepEqual(
    found.map((item) => item.remote.id).sort(),
    ['far-due', 'far-start', 'near', 'no-date', 'overdue', 'start-near-due-far'],
  );
});
test('разбор: время, заданное при приёме, уходит в задачу и обратно в TickTick', () => {
  const { state, connection, enId } = setup();
  const incoming = findIncomingTasks(
    connection,
    byProject([remote('timed', { dueDate: '2026-10-28T00:00:00+0300' })]),
    new Date('2026-10-01T00:00:00Z'),
  )[0];
  const accepted = acceptIncomingTask(state, connection, incoming, {
    sphere: 'english',
    goalId: enId,
    startsAt: '2026-10-28T13:00',
    dueAt: '2026-10-28T15:00',
  }, 'timed-1');
  assert.equal(accepted.task.startsAt, '2026-10-28T13:00');
  assert.equal(accepted.task.dueAt, '2026-10-28T15:00');
  const update = accepted.remoteUpdate as { startDate: string; dueDate: string; isAllDay: boolean };
  assert.ok(update.startDate);
  assert.ok(update.dueDate);
  assert.equal(update.isAllDay, false);
});
test('разбор: без выбора времени день и isAllDay в TickTick не трогаются', () => {
  const { state, connection, enId } = setup();
  const incoming = findIncomingTasks(
    connection,
    byProject([remote('plain', { dueDate: '2026-10-28T00:00:00+0300' })]),
    new Date('2026-10-01T00:00:00Z'),
  )[0];
  const accepted = acceptIncomingTask(state, connection, incoming, { sphere: 'english', goalId: enId }, 'plain-1');
  assert.equal(accepted.task.dueAt, '2026-10-28');
  const update = accepted.remoteUpdate as Record<string, unknown>;
  assert.equal('startDate' in update, false);
  assert.equal('dueDate' in update, false);
});
test('разбор: начало позже срока отклоняется, состояние не меняется', () => {
  const { state, connection, enId } = setup();
  const incoming = findIncomingTasks(
    connection,
    byProject([remote('bad-interval', { dueDate: '2026-10-28T00:00:00+0300' })]),
    new Date('2026-10-01T00:00:00Z'),
  )[0];
  assert.throws(
    () =>
      acceptIncomingTask(state, connection, incoming, {
        sphere: 'english',
        goalId: enId,
        startsAt: '2026-10-28T18:00',
        dueAt: '2026-10-28T15:00',
      }),
    /Начало не может быть позже срока/,
  );
  assert.equal(state.quests.length, 0);
});
test('formatIncomingDate: во входящих показывает час задачи из TickTick, а не только день', () => {
  assert.equal(formatIncomingDate(undefined), '');
  // Полночь по смещению TickTick — задача без конкретного времени, только день.
  assert.equal(formatIncomingDate('2026-10-28T00:00:00+0300'), '28 октября');
  // Настоящее время — показывается рядом с днём, в местном часе среды выполнения.
  const moment = new Date('2026-10-28T19:30:00+0300');
  const hh = String(moment.getHours()).padStart(2, '0'), mm = String(moment.getMinutes()).padStart(2, '0');
  assert.equal(formatIncomingDate('2026-10-28T19:30:00+0300'), `28 октября, ${hh}:${mm}`);
});
