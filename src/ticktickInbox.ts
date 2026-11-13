import { validTaskLabels } from './taskLabels.ts';
// Входящие задачи TickTick: новые задачи из сопоставленных списков не попадают в игру сами.
// Игрок выбирает сферу, цель и этап, и только после этого создаётся задача цели и её связь.
import { dateKey, spheres } from './game.ts';
import type { GameState, Goal, GoalStage, Quest, TaskLabel } from './game.ts';
import { saveTask } from './planning.ts';
import {
  localFingerprint,
  remoteFields,
  remoteFingerprint,
  remotePayload,
} from './ticktick.ts';
import type { RemoteTask, TickTickConnection } from './ticktick.ts';

export type IncomingTask = {
  remote: RemoteTask;
  projectId: string;
  /** Сфера, списка которой задача содержит; подсказка для выбора. */
  sphere: string;
  /** Копия с тем же названием и описанием, но другим ID/датой — показать для ручной проверки. */
  possibleDuplicate?: boolean;
};
/** Контекст разбора из сферы, цели или открытого этапа. */
export type IncomingScope = {
  sphereId: string;
  goalId?: string;
  stageId?: string;
};

/** Сравниваем список, а не подсказку item.sphere: один список может быть у нескольких сфер. */
export function incomingForScope(incoming: IncomingTask[], connection: TickTickConnection, scope?: IncomingScope): IncomingTask[] {
  if (!scope) return incoming;
  const projectId = connection.sphereLists?.[scope.sphereId];
  return projectId ? incoming.filter((item) => item.projectId === projectId) : [];
}

export type IncomingChoice = {
  labels?: TaskLabel[];
  editor?: Partial<Pick<Quest, 'name' | 'notes' | 'startsAt' | 'dueAt' | 'deadlineAt' | 'priority' | 'difficulty' | 'estimateMinutes' | 'details' | 'coverImage' | 'subtasks' | 'repeat' | 'planning' | 'rewardCoins' | 'virtualRewardId' | 'labelId' | 'tickTickSync' | 'weight' | 'required'>>;
  sphere: string;
  /** Пустая строка — одиночная задача без цели (синхронизируется так же). */
  goalId: string;
  stageId?: string;
  /**
   * Время выполнения (интервал «с … до …»), заданное при разборе — так же, как в окне уже
   * принятой задачи (0.48.5/0.48.8): день берётся из TickTick, а время можно задать здесь и
   * оно сразу уйдёт обратно в TickTick. Не заданы — время остаётся таким, какое прислал TickTick.
   */
  startsAt?: string | null;
  dueAt?: string;
};
export type IncomingAccepted = {
  state: GameState;
  connection: TickTickConnection;
  task: Quest;
  /** Тело обновления задачи в TickTick: добавляет цель, этап и служебную метку. */
  remoteUpdate: Record<string, unknown> | null;
};

const idPattern = /^[\w-]{1,100}$/;
export const maxTaskName = 100;
export const dismissedLimit = 2000;

/** Списки TickTick, выбранные для сфер, без повторов. */
export function mappedProjectIds(connection: TickTickConnection) {
  return [
    ...new Set(Object.values(connection.sphereLists ?? {}).filter(Boolean)),
  ];
}

// Ровно полночь (с учётом смещения TickTick) — это не время, а просто календарный день;
// то же правило использует iso() в src/ticktick.ts и hasTime() в src/tasksCalendar.ts.
const midnightAt = /T00:00(:00)?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;
/** Дата (и время, если оно задано) задачи TickTick для показа во входящих: «28 октября» или «28 октября, 19:30». */
export function formatIncomingDate(value?: string | null): string {
  if (!value) return '';
  if (midnightAt.test(value)) {
    // Весь день — берём календарный день прямо из даты строки, без перевода через
    // часовой пояс среды: иначе смещение TickTick может сдвинуть день на соседние сутки
    // (тот же класс ошибки, что в remoteFields() src/ticktick.ts, версия 0.48.5).
    const date = new Date(`${value.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${day}, ${time}`;
}

const markerPattern = /\[PYL:([\w-]+)/;
type LocalTaskIdentity = Pick<Quest, 'name' | 'notes'>;
type LocalTaskIndex = ReadonlySet<string> | ReadonlyMap<string, LocalTaskIdentity>;
type Ownership = { gameOwned: boolean; possibleDuplicate: boolean; changedFromSource?: boolean };

function normalized(value?: string | null) {
  return (value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}
function comparableNotes(value?: string | null) {
  return normalized((value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n\s*— PLAY YOUR LIFE —[\s\S]*$/i, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\\?\[PYL:[\w-]+\\?\]/g, ' '));
}
function contentIdentity(name: string, notes?: string | null) {
  return `${normalized(name)}\u0000${comparableNotes(notes)}`;
}
function fingerprintIdentity(fingerprint?: string) {
  if (!fingerprint) return undefined;
  try {
    const parsed: unknown = JSON.parse(fingerprint);
    if (Array.isArray(parsed) && typeof parsed[0] === 'string')
      return contentIdentity(parsed[0], typeof parsed[1] === 'string' ? parsed[1] : '');
    if (parsed && typeof parsed === 'object' && 'name' in parsed && typeof parsed.name === 'string')
      return contentIdentity(parsed.name, 'notes' in parsed && typeof parsed.notes === 'string' ? parsed.notes : '');
  } catch { /* Старый или неполный отпечаток не позволяет безопасно сравнить копии. */ }
  return undefined;
}
/**
 * Метка [PYL:id] только указывает на исходник: изменённое название/описание делает копию новой
 * задачей. Совпадающее содержимое с другим ID помечается возможным дублем; исходник и единственная
 * задача после сбоя сохранения связи не предлагаются как новые.
 */
function gameOwnedFilter(connection: TickTickConnection, remoteByProject: Record<string, RemoteTask[]>, localTasks?: LocalTaskIndex) {
  const linkedByLocal = new Map(Object.entries(connection.links).map(([localId, link]) => [localId, link.remoteId]));
  const markerOwners = new Map<string, Set<string>>();
  const remoteById = new Map<string, RemoteTask>();
  for (const list of Object.values(remoteByProject))
    for (const remote of list ?? []) {
      if (typeof remote?.id === 'string') remoteById.set(remote.id, remote);
      const marker = markerPattern.exec(remote?.content ?? '')?.[1];
      if (!marker || typeof remote.id !== 'string') continue;
      markerOwners.set(marker, (markerOwners.get(marker) ?? new Set<string>()).add(remote.id));
    }
  return (remote: RemoteTask): Ownership => {
    const content = remote.content ?? '';
    if (!content.includes('[PYL:')) return { gameOwned: false, possibleDuplicate: false };
    const marker = markerPattern.exec(content)?.[1];
    if (!marker) return { gameOwned: true, possibleDuplicate: false };
    const linkedRemote = linkedByLocal.get(marker);
    if (linkedRemote === remote.id) return { gameOwned: true, possibleDuplicate: false };
    const localExists = localTasks?.has(marker);
    if (localTasks && !localExists) return { gameOwned: false, possibleDuplicate: false };
    const link = connection.links[marker];
    const sourceRemote = link ? remoteById.get(link.remoteId) : undefined;
    const sourceFields = sourceRemote ? remoteFields(sourceRemote) : undefined;
    const localTask = localTasks instanceof Map ? localTasks.get(marker) : undefined;
    const baseline = sourceFields
      ? contentIdentity(sourceFields.name, sourceFields.notes)
      : fingerprintIdentity(link?.remote) ?? (localTask ? contentIdentity(localTask.name, localTask.notes) : undefined);
    const duplicateCount = markerOwners.get(marker)?.size ?? 1;
    if (baseline) {
      const candidate = remoteFields(remote);
      if (contentIdentity(candidate.name, candidate.notes) !== baseline)
        return { gameOwned: false, possibleDuplicate: false, changedFromSource: true };
      // A saved link proves this is another TickTick object, even when its original is no longer
      // in the active task response. Never hide a same-content copy merely because it is alone.
      if (link && link.remoteId !== remote.id)
        return { gameOwned: false, possibleDuplicate: true };
      return duplicateCount > 1
        ? { gameOwned: false, possibleDuplicate: true }
        : { gameOwned: true, possibleDuplicate: false };
    }
    if (link && link.remoteId !== remote.id)
      return { gameOwned: false, possibleDuplicate: duplicateCount > 1 };
    if (duplicateCount > 1) return { gameOwned: false, possibleDuplicate: true };
    // Один несвязанный экземпляр с живой меткой может быть задачей игры после сбоя записи связи.
    return { gameOwned: true, possibleDuplicate: false };
  };
}

function duplicateContentFilter(remoteByProject: Record<string, RemoteTask[]>) {
  const owners = new Map<string, Set<string>>();
  for (const [projectId, tasks] of Object.entries(remoteByProject))
    for (const remote of tasks ?? []) {
      if (typeof remote?.id !== 'string' || typeof remote.title !== 'string') continue;
      const key = `${projectId}\u0000${contentIdentity(remote.title, remote.content)}`;
      owners.set(key, (owners.get(key) ?? new Set<string>()).add(remote.id));
    }
  return (projectId: string, remote: RemoteTask) =>
    (owners.get(`${projectId}\u0000${contentIdentity(remote.title, remote.content)}`)?.size ?? 0) > 1;
}

export function findIncomingTasks(
  connection: TickTickConnection,
  remoteByProject: Record<string, RemoteTask[]>,
  localTasks?: LocalTaskIndex,
): IncomingTask[] {
  const linked = new Set(
    Object.values(connection.links).map((link) => link.remoteId),
  );
  const dismissed = new Set(connection.dismissed);
  const seen = new Set<string>();
  const classify = gameOwnedFilter(connection, remoteByProject, localTasks);
  const hasContentPeer = duplicateContentFilter(remoteByProject);
  const found: IncomingTask[] = [];
  for (const sphere of spheres) {
    const projectId = connection.sphereLists?.[sphere.id];
    if (!projectId) continue;
    for (const remote of remoteByProject[projectId] ?? []) {
      if (
        !remote ||
        typeof remote.id !== 'string' ||
        !idPattern.test(remote.id) ||
        seen.has(remote.id) ||
        linked.has(remote.id) ||
        dismissed.has(remote.id) ||
        typeof remote.title !== 'string' ||
        !remote.title.trim() ||
        // Выполненные и отменённые задачи не предлагаем.
        (remote.status ?? 0) !== 0
      )
        continue;
      const ownership = classify(remote);
      if (ownership.gameOwned) continue;
      // Не импортируем голую серию повторов как множество новых задач. Копию с меткой,
      // изменённым содержимым или требующую проверки, оставляем видимой во входящих.
      if (remote.repeatFlag?.trim() && !remote.content?.includes('[PYL:')) continue;
      seen.add(remote.id);
      found.push({
        remote: { ...remote, projectId: remote.projectId || projectId },
        projectId,
        sphere: sphere.id,
        ...(ownership.possibleDuplicate || (!ownership.changedFromSource && hasContentPeer(projectId, remote)) ? { possibleDuplicate: true } : {}),
      });
    }
  }
  return found;
}

/** All dated mapped-list tasks for the calendar, including tasks far beyond any inbox date range. */
export function findTickTickCalendarTasks(
  connection: TickTickConnection,
  remoteByProject: Record<string, RemoteTask[]>,
  localTasks?: LocalTaskIndex,
): IncomingTask[] {
  const linked = new Set(Object.values(connection.links).map((link) => link.remoteId));
  const seen = new Set<string>();
  const classify = gameOwnedFilter(connection, remoteByProject, localTasks);
  const hasContentPeer = duplicateContentFilter(remoteByProject);
  const found: IncomingTask[] = [];
  for (const sphere of spheres) {
    const projectId = connection.sphereLists?.[sphere.id];
    if (!projectId) continue;
    for (const remote of remoteByProject[projectId] ?? []) {
      if (!remote || typeof remote.id !== 'string' || !idPattern.test(remote.id) || seen.has(remote.id) ||
        linked.has(remote.id) || typeof remote.title !== 'string' || !remote.title.trim() ||
        ((remote.status ?? 0) !== 0 && remote.status !== 2)) continue;
      const ownership = classify(remote);
      if (ownership.gameOwned || ownership.possibleDuplicate || (!ownership.changedFromSource && hasContentPeer(projectId, remote))) continue;
      let fields: ReturnType<typeof remoteFields>;
      try { fields = remoteFields(remote); } catch { continue; }
      if (!fields.dueAt && !fields.startsAt) continue;
      seen.add(remote.id);
      found.push({ remote: { ...remote, projectId: remote.projectId || projectId }, projectId, sphere: sphere.id });
    }
  }
  return found;
}

/** Входящие, срок или начало которых приходится на точный локальный календарный день сегодня. */
export function incomingForToday(incoming: IncomingTask[], now: Date = new Date()): IncomingTask[] {
  const today = dateKey(now);
  return incoming.filter((item) => {
    const value = item.remote.dueDate || item.remote.startDate;
    if (!value) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && dateKey(date) === today;
  });
}

/** Цели сферы, в которые можно добавить задачу. */
export function goalsForSphere(state: GameState, sphere: string): Goal[] {
  return state.goals.filter(
    (goal) => goal.sphere === sphere && goal.current < goal.target,
  );
}
/** Этапы цели, в которые ещё можно добавлять задачи. */
export function openStages(goal: Goal | undefined): GoalStage[] {
  return (goal?.stages ?? []).filter((stage) => stage.status !== 'completed');
}

/** Whitelist draft fields: remote identity, completion and reward state cannot be supplied by the editor. */
function editorFields(choice: IncomingChoice) {
  const draft = choice.editor;
  if (!draft) return {};
  return Object.fromEntries((['name', 'notes', 'startsAt', 'dueAt', 'deadlineAt', 'priority', 'difficulty', 'estimateMinutes', 'details', 'coverImage', 'subtasks', 'repeat', 'planning', 'rewardCoins', 'virtualRewardId', 'labelId', 'tickTickSync', 'weight', 'required'] as const)
    .filter(key => Object.hasOwn(draft, key)).map(key => [key, draft[key]])) as IncomingChoice['editor'];
}

/** Применяет время (если задано при разборе) к полям задачи из TickTick; день остаётся как в TickTick. */
function withChoiceTime(fields: ReturnType<typeof remoteFields>, choice: IncomingChoice): ReturnType<typeof remoteFields> {
  if (choice.dueAt === undefined && choice.startsAt === undefined) return fields;
  const dueAt = choice.dueAt !== undefined ? choice.dueAt : fields.dueAt;
  const startsAt = choice.startsAt !== undefined ? (choice.startsAt ?? undefined) : fields.startsAt;
  if (startsAt && dueAt && new Date(startsAt).getTime() > new Date(dueAt).getTime())
    throw new Error('Начало не может быть позже срока.');
  return { ...fields, dueAt, startsAt };
}

export function acceptIncomingTask(
  state: GameState,
  connection: TickTickConnection,
  incoming: IncomingTask,
  choice: IncomingChoice,
  taskId: string = crypto.randomUUID(),
  ownerId = 'local',
): IncomingAccepted {
  if (choice.editor?.repeat && incoming.remote.repeatFlag) throw new Error('Повтор уже настроен в TickTick. Второй повтор создаст дубликаты.');
  if (choice.labels) {
    if (!validTaskLabels(choice.labels)) throw new Error('Проверь метки задач.');
    state = { ...state, taskLabels: choice.labels };
  }
  if (!choice.goalId) return acceptSingleTask(state, connection, incoming, choice, taskId, ownerId);
  const goal = state.goals.find((g) => g.id === choice.goalId);
  if (!goal) throw new Error('Выбери проект или «Без проекта».');
  if (goal.sphere !== choice.sphere)
    throw new Error('Этот проект относится к другой сфере.');
  const stage = choice.stageId
    ? goal.stages?.find((s) => s.id === choice.stageId)
    : undefined;
  if (choice.stageId && !stage) throw new Error('Этап не найден в выбранном проекте.');
  if (state.quests.some((q) => q.id === taskId))
    throw new Error('Задача уже добавлена.');
  const fields = { ...withChoiceTime(remoteFields(incoming.remote), choice), ...editorFields(choice) };
  const name = fields.name.trim().slice(0, maxTaskName);
  if (!name) throw new Error('У задачи TickTick нет названия.');
  // saveTask проверяет сроки цели и этапа и сообщает понятную ошибку.
  const next = saveTask(state, {
    ...fields,
    id: taskId,
    name,
    sphere: goal.sphere,
    difficulty: choice.editor?.difficulty ?? 'Medium',
    goalId: goal.id,
    stageId: stage?.id,
    ...(choice.editor ? { sourceType: 'USER_CREATED' as const, ownerId, rewardCoins: choice.editor.rewardCoins ?? 0 } : {}),
    tickTickSharedAt: new Date().toISOString(),
  });
  const task = next.quests.find((q) => q.id === taskId);
  if (!task) throw new Error('Не удалось добавить задачу.');
  const scoped = { ...connection, projectId: incoming.projectId };
  const payload = remotePayload(task, next, scoped);
  return {
    state: next,
    task,
    // Название и заметку обновляем всегда; день/время — только если его задали при разборе
    // (обычно дата и так уже в TickTick, менять её оттуда не нужно).
    remoteUpdate: {
      id: incoming.remote.id,
      projectId: incoming.projectId,
      title: choice.editor ? task.name : incoming.remote.title,
      ...(choice.editor ? { priority: payload.priority } : {}),
      content: payload.content,
      ...(choice.editor || choice.dueAt !== undefined || choice.startsAt !== undefined
        ? { startDate: payload.startDate, dueDate: payload.dueDate, isAllDay: payload.isAllDay, timeZone: payload.timeZone }
        : {}),
    },
    connection: {
      ...connection,
      links: {
        ...connection.links,
        [task.id]: {
          remoteId: incoming.remote.id,
          local: localFingerprint(task, next),
          remote: remoteFingerprint(incoming.remote),
          goalId: goal.id,
          projectId: incoming.projectId,
        },
      },
    },
  };
}

/** Одиночная задача без цели: тоже связывается с TickTick и синхронизируется. */
function acceptSingleTask(
  state: GameState,
  connection: TickTickConnection,
  incoming: IncomingTask,
  choice: IncomingChoice,
  taskId: string,
  ownerId: string,
): IncomingAccepted {
  if (!state.spheres[choice.sphere]) throw new Error('Выбери сферу.');
  if (state.quests.some((q) => q.id === taskId)) throw new Error('Задача уже добавлена.');
  const fields = { ...withChoiceTime(remoteFields(incoming.remote), choice), ...editorFields(choice) };
  const name = fields.name.trim().slice(0, maxTaskName);
  if (!name) throw new Error('У задачи TickTick нет названия.');
  const next = saveTask(state, { ...fields, id: taskId, name, sphere: choice.sphere, difficulty: choice.editor?.difficulty ?? 'Medium', sourceType: 'USER_CREATED', ownerId, rewardCoins: choice.editor?.rewardCoins ?? 0, tickTickSharedAt: new Date().toISOString() });
  const task = next.quests.find((q) => q.id === taskId);
  if (!task) throw new Error('Не удалось добавить задачу.');
  const scoped = { ...connection, projectId: incoming.projectId };
  const payload = remotePayload(task, next, scoped);
  return {
    state: next,
    task,
    remoteUpdate: {
      id: incoming.remote.id,
      projectId: incoming.projectId,
      title: choice.editor ? task.name : incoming.remote.title,
      ...(choice.editor ? { priority: payload.priority } : {}),
      content: payload.content,
      ...(choice.editor || choice.dueAt !== undefined || choice.startsAt !== undefined
        ? { startDate: payload.startDate, dueDate: payload.dueDate, isAllDay: payload.isAllDay, timeZone: payload.timeZone }
        : {}),
    },
    connection: {
      ...connection,
      links: {
        ...connection.links,
        [task.id]: { remoteId: incoming.remote.id, local: localFingerprint(task, next), remote: remoteFingerprint(incoming.remote), projectId: incoming.projectId },
      },
    },
  };
}

export function dismissIncomingTask(
  connection: TickTickConnection,
  remoteId: string,
): TickTickConnection {
  return {
    ...connection,
    dismissed: [...new Set([...connection.dismissed, remoteId])].slice(
      -dismissedLimit,
    ),
  };
}
