// Входящие задачи TickTick: новые задачи из сопоставленных списков не попадают в игру сами.
// Игрок выбирает сферу, цель и этап, и только после этого создаётся задача цели и её связь.
import { dateKey, spheres } from './game.ts';
import type { GameState, Goal, GoalStage, Quest } from './game.ts';
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
  /** Сфера, список которой содержит задачу; подсказка для выбора. */
  sphere: string;
};
export type IncomingChoice = {
  sphere: string;
  /** Пустая строка — одиночная задача без цели (синхронизируется так же). */
  goalId: string;
  stageId?: string;
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

/** Во входящие попадают задачи со сроком не дальше этого числа месяцев от сегодня. */
export const inboxHorizonMonths = 4;

/** Граница «далёкого будущего»: сегодня плюс четыре месяца. */
export function inboxHorizon(now: Date = new Date()): Date {
  const limit = new Date(now);
  limit.setMonth(limit.getMonth() + inboxHorizonMonths);
  return limit;
}

/** true, если срок задачи (или, без него, её начало) дальше границы. Задачи без дат остаются. */
function beyondHorizon(remote: RemoteTask, limit: Date): boolean {
  const value = remote.dueDate || remote.startDate;
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() > limit.getTime();
}

export function findIncomingTasks(
  connection: TickTickConnection,
  remoteByProject: Record<string, RemoteTask[]>,
  now: Date = new Date(),
): IncomingTask[] {
  const limit = inboxHorizon(now);
  const linked = new Set(
    Object.values(connection.links).map((link) => link.remoteId),
  );
  const dismissed = new Set(connection.dismissed);
  const seen = new Set<string>();
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
        (remote.status ?? 0) !== 0 ||
        // Задачи, созданные самой игрой, уже имеют связь или восстановятся сервером.
        (remote.content ?? '').includes('[PYL:') ||
        // Повторяющиеся задачи с датами в 2027 году и дальше не подтягиваем.
        beyondHorizon(remote, limit)
      )
        continue;
      seen.add(remote.id);
      found.push({
        remote: { ...remote, projectId: remote.projectId || projectId },
        projectId,
        sphere: sphere.id,
      });
    }
  }
  return found;
}

/** Входящие, срок или начало которых сегодня или раньше: они тоже «на сегодня», хотя ещё не приняты в игру. */
export function incomingForToday(incoming: IncomingTask[], now: Date = new Date()): IncomingTask[] {
  const today = dateKey(now);
  return incoming.filter((item) => {
    const value = item.remote.dueDate || item.remote.startDate;
    if (!value) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && dateKey(date) <= today;
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

export function acceptIncomingTask(
  state: GameState,
  connection: TickTickConnection,
  incoming: IncomingTask,
  choice: IncomingChoice,
  taskId: string = crypto.randomUUID(),
  ownerId = 'local',
): IncomingAccepted {
  if (!choice.goalId) return acceptSingleTask(state, connection, incoming, choice, taskId, ownerId);
  const goal = state.goals.find((g) => g.id === choice.goalId);
  if (!goal) throw new Error('Выбери цель или «Без цели».');
  if (goal.sphere !== choice.sphere)
    throw new Error('Эта цель относится к другой сфере.');
  const stage = choice.stageId
    ? goal.stages?.find((s) => s.id === choice.stageId)
    : undefined;
  if (choice.stageId && !stage) throw new Error('Этап не найден в выбранной цели.');
  if (state.quests.some((q) => q.id === taskId))
    throw new Error('Задача уже добавлена.');
  const fields = remoteFields(incoming.remote);
  const name = fields.name.trim().slice(0, maxTaskName);
  if (!name) throw new Error('У задачи TickTick нет названия.');
  // saveTask проверяет сроки цели и этапа и сообщает понятную ошибку.
  const next = saveTask(state, {
    ...fields,
    id: taskId,
    name,
    sphere: goal.sphere,
    difficulty: 'Medium',
    goalId: goal.id,
    stageId: stage?.id,
  });
  const task = next.quests.find((q) => q.id === taskId);
  if (!task) throw new Error('Не удалось добавить задачу.');
  const scoped = { ...connection, projectId: incoming.projectId };
  const payload = remotePayload(task, next, scoped);
  return {
    state: next,
    task,
    // Только название и заметка: даты и приоритет в TickTick не трогаем.
    remoteUpdate: {
      id: incoming.remote.id,
      projectId: incoming.projectId,
      title: incoming.remote.title,
      content: payload.content,
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
  const fields = remoteFields(incoming.remote);
  const name = fields.name.trim().slice(0, maxTaskName);
  if (!name) throw new Error('У задачи TickTick нет названия.');
  const next = saveTask(state, { ...fields, id: taskId, name, sphere: choice.sphere, difficulty: 'Medium', sourceType: 'USER_CREATED', ownerId, rewardCoins: 0 });
  const task = next.quests.find((q) => q.id === taskId);
  if (!task) throw new Error('Не удалось добавить задачу.');
  const scoped = { ...connection, projectId: incoming.projectId };
  const payload = remotePayload(task, next, scoped);
  return {
    state: next,
    task,
    remoteUpdate: { id: incoming.remote.id, projectId: incoming.projectId, title: incoming.remote.title, content: payload.content },
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
