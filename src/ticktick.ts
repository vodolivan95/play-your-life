import { completeQuest, spheres } from './game.ts';
import type { GameState, Quest } from './game.ts';
import { isGoalTask, saveTask } from './planning.ts';
import type { TickTickLink } from './ticktickSettings.ts';
export type { TickTickLink } from './ticktickSettings.ts';
export type RemoteTask = {
  id: string;
  projectId: string;
  title: string;
  content?: string;
  startDate?: string | null;
  dueDate?: string | null;
  priority?: number;
  status?: number;
};
export type TickTickConnection = {
  auth?: 'firebase';
  revision?: number;
  activated?: boolean; // Previously verified access; protects restores while offline.
  url: string;
  key: string;
  projectId: string; // Legacy single-list setting; retained for existing links.
  sphereLists?: Record<string, string>;
  auto: boolean;
  deleteRemote: boolean;
  links: Record<string, TickTickLink>;
  dismissed: string[];
  lastSync?: string;
};
export const connectionStorageKey = 'play-your-life-ticktick-v1';
export function newConnection(url: string): TickTickConnection {
  const parsed = new URL(url);
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== '/'
  )
    throw new Error(
      'Укажи адрес HTTPS сервера подключения, без пути и параметров.',
    );
  return {
    url: parsed.origin,
    key: Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
      n.toString(16).padStart(2, '0'),
    ).join(''),
    projectId: '',
    sphereLists: {},
    auto: true,
    deleteRemote: false,
    links: {},
    dismissed: [],
  };
}
// Preferred existing list names supplied by the user; names are not API IDs.
export const tickTickListNames: Record<string, string> = {
  health: 'Здоровье',
  sport: 'Спорт',
  growth: 'Саморазвитие',
  english: 'Английский язык',
  finance: 'Финансы',
  together: 'Совместные задачи',
  driving: 'Вождение',
  tasks: 'Задачи',
  hobby: 'Досуг и хобби',
};
export function matchSphereLists(
  projects: { id: string; name: string }[],
  current: Record<string, string> = {},
) {
  const normalize = (name: string) =>
    name
      .toLocaleLowerCase('ru-RU')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  const mappings = { ...current };
  for (const sphere of spheres) {
    if (Object.hasOwn(current, sphere.id)) continue;
    // Prefer the user's exact list name; fall back to the application label.
    for (const name of [tickTickListNames[sphere.id], sphere.name]) {
      const matches = projects.filter(
        (project) => normalize(project.name) === normalize(name),
      );
      if (matches.length === 1) {
        mappings[sphere.id] = matches[0].id;
        break;
      }
      if (matches.length > 1) break;
    }
  }
  return mappings;
}
export function hasTickTickTargets(connection: TickTickConnection) {
  return (
    Object.values(connection.sphereLists ?? {}).some(Boolean) ||
    Object.values(connection.links).some(
      (link) => link.projectId || connection.projectId,
    )
  );
}
function taskProject(connection: TickTickConnection, task: Quest) {
  return connection.sphereLists?.[task.sphere];
}
export async function bridgeRequest<T>(
  connection: TickTickConnection,
  path: string,
  method = 'GET',
  body?: unknown,
  getToken?: () => Promise<string>,
): Promise<T> {
  const credential = connection.auth === 'firebase'
    ? await (getToken ? getToken() : Promise.reject(new Error('Войдите в аккаунт PLAY YOUR LIFE.')))
    : connection.key;
  const response = await fetch(`${connection.url}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${credential}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    let message = 'Сервер TickTick недоступен.';
    try {
      const error = (await response.json()) as { error?: string };
      message = error.error ?? message;
    } catch {
      /* Empty upstream errors do not prove success. */
    }
    throw new Error(`${message} (${response.status})`);
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}
function iso(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new Error('TickTick вернул некорректную дату.');
  return date.toISOString();
}
function notes(content?: string) {
  return (content ?? '')
    .split('\n\n— PLAY YOUR LIFE —')[0]
    .replace(/\n?\[PYL:[\w-]+\]/g, '')
    .trim();
}
export function localFingerprint(task: Quest, state?: GameState) {
  return JSON.stringify([
    task.name,
    task.notes?.trim() ?? '',
    task.startsAt ?? null,
    task.dueAt ?? null,
    task.priority ?? 'normal',
    task.goalId ?? null,
    task.stageId ?? null,
    task.estimateMinutes ?? null,
    state?.goals.find((g) => g.id === task.goalId)?.name ?? null,
    state?.goals
      .find((g) => g.id === task.goalId)
      ?.stages?.find((s) => s.id === task.stageId)?.name ?? null,
  ]);
}
function remoteFields(remote: RemoteTask) {
  return {
    name: remote.title,
    notes: notes(remote.content),
    startsAt: iso(remote.startDate),
    dueAt: iso(remote.dueDate),
    priority: (remote.priority === 5
      ? 'high'
      : remote.priority === 1
        ? 'low'
        : 'normal') as Quest['priority'],
  };
}
function remoteFingerprint(remote: RemoteTask) {
  return localFingerprint({
    ...remoteFields(remote),
    id: remote.id,
    sphere: 'tasks',
    xp: 20,
    difficulty: 'Medium',
    done: false,
  });
}
export function remotePayload(
  task: Quest,
  state: GameState,
  connection: TickTickConnection,
) {
  const goal = state.goals.find((g) => g.id === task.goalId);
  const stage = goal?.stages?.find((s) => s.id === task.stageId);
  const content = [
    task.notes?.trim() ?? '',
    '',
    '— PLAY YOUR LIFE —',
    goal ? `Цель: ${goal.name}` : '',
    stage ? `Этап: ${stage.name}` : '',
    task.estimateMinutes ? `Выделить: ${task.estimateMinutes} мин` : '',
    `[PYL:${task.id}]`,
  ]
    .filter((line, index) => line || index < 2)
    .join('\n');
  const stamp = (value?: string) =>
    value ? new Date(value).toISOString().replace(/\.\d{3}Z$/, '+0000') : null;
  return {
    title: task.name,
    content,
    projectId: connection.projectId,
    startDate: stamp(task.startsAt),
    dueDate: stamp(task.dueAt),
    isAllDay: false,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    priority: task.priority === 'high' ? 5 : task.priority === 'low' ? 1 : 3,
  };
}
export type TickTickResult = {
  connection: TickTickConnection;
  changes: {
    id: string;
    snapshot: string;
    remote: RemoteTask;
    previousRemote?: string;
  }[];
  warnings: string[];
};
async function syncTickTickProject(
  state: GameState,
  connection: TickTickConnection,
  request: <T>(path: string, method?: string, body?: unknown) => Promise<T>,
  allLinks: TickTickConnection['links'],
  taskIds?: readonly string[],
): Promise<TickTickResult> {
  if (!connection.projectId)
    throw new Error('Выбери список TickTick для синхронизации.');
  const project = encodeURIComponent(connection.projectId);
  const data = await request<{ tasks?: RemoteTask[] }>(
    `/api/project/${project}/data`,
  );
  if (!Array.isArray(data.tasks))
    throw new Error('TickTick не вернул список задач.');
  const result: TickTickResult = {
    connection: {
      ...connection,
      links: { ...connection.links },
      dismissed: [...connection.dismissed],
    },
    changes: [],
    warnings: [],
  };
  const remoteTasks = new Map(data.tasks.map((t) => [t.id, t]));
  for (const [localId, link] of Object.entries(connection.links)) {
    const local = state.quests.find((q) => q.id === localId);
    const path = `/api/project/${project}/task/${encodeURIComponent(link.remoteId)}`;
    if (!local) {
      if (connection.deleteRemote && link.goalId) {
        try {
          await request(path, 'DELETE');
        } catch (error) {
          if (!(error instanceof Error && error.message.endsWith('(404)')))
            throw error;
          result.warnings.push(
            'Удаление в TickTick не подтверждено: задача недоступна.',
          );
          result.connection.dismissed.push(link.remoteId);
        }
      } else result.connection.dismissed.push(link.remoteId);
      delete result.connection.links[localId];
      continue;
    }
    // Existing standalone/imported tasks remain untouched when narrowing the scope.
    if (!isGoalTask(state, local)) {
      result.connection.dismissed.push(link.remoteId);
      delete result.connection.links[localId];
      continue;
    }
    // Closed actions remain immutable. Avoid one request per historical quest each minute.
    if (local.done && link.done && !remoteTasks.has(link.remoteId)) continue;
    let remote = remoteTasks.get(link.remoteId);
    if (!remote) {
      try {
        remote = await request<RemoteTask>(path);
      } catch (error) {
        result.warnings.push(
          `${local.name}: ${error instanceof Error ? error.message : 'не удалось получить задачу'}. Выполнение и удаление не подтверждены.`,
        );
        continue;
      }
    }
    if (!remote.id)
      throw new Error('TickTick вернул задачу без идентификатора.');
    const remoteWasCompleted = remote.status === 2;
    const snapshot = localFingerprint(local, state);
    const localChanged = snapshot !== link.local;
    const remoteChanged = remoteFingerprint(remote) !== link.remote;
    if (local.done && remote.status !== 2) {
      await request(`${path}/complete`, 'POST');
      remote = { ...remote, status: 2 };
    }
    if (!local.done && localChanged) {
      if (remoteChanged)
        result.warnings.push(
          `${local.name}: одновременные изменения; сохранён вариант PLAY YOUR LIFE.`,
        );
      remote = await request<RemoteTask>(
        `/api/task/${encodeURIComponent(remote.id)}`,
        'POST',
        { ...remotePayload(local, state, connection), id: remote.id },
      );
      if (!remote.id)
        throw new Error('Изменение задачи не подтверждено TickTick.');
      if (remoteWasCompleted && remote.status !== 2) {
        await request(`${path}/complete`, 'POST');
        remote = { ...remote, status: 2 };
      }
    }
    // Completion wins; reopening an already rewarded action never creates new XP.
    const wasCompleted =
      data.tasks.find((t) => t.id === link.remoteId)?.status === 2 ||
      remote.status === 2 ||
      remoteWasCompleted;
    if (remoteChanged || wasCompleted)
      result.changes.push({
        id: localId,
        snapshot,
        previousRemote: link.remote,
        remote: { ...remote, status: wasCompleted ? 2 : remote.status },
      });
    result.connection.links[localId] = {
      remoteId: remote.id,
      local: snapshot,
      remote: remoteFingerprint(remote),
      done: local.done || wasCompleted,
      goalId: local.goalId,
      projectId: connection.projectId,
    };
  }
  for (const local of state.quests.filter(
    (q) =>
      !q.done &&
      (!taskIds || taskIds.includes(q.id)) &&
      isGoalTask(state, q) &&
      !allLinks[q.id] &&
      taskProject(connection, q) === connection.projectId,
  )) {
    const remote = await request<RemoteTask>('/create', 'POST', {
      ...remotePayload(local, state, connection),
      localId: local.id,
    });
    if (!remote.id) throw new Error('TickTick не подтвердил создание задачи.');
    result.connection.links[local.id] = {
      remoteId: remote.id,
      local: localFingerprint(local, state),
      remote: remoteFingerprint(remote),
      goalId: local.goalId,
      projectId: connection.projectId,
    };
    if (remote.status === 2)
      result.changes.push({
        id: local.id,
        snapshot: localFingerprint(local, state),
        remote,
      });
  }
  result.connection.lastSync = new Date().toISOString();
  return result;
}
export async function syncTickTick(
  state: GameState,
  connection: TickTickConnection,
  request: <T>(path: string, method?: string, body?: unknown) => Promise<T> = (
    path,
    method,
    body,
  ) => bridgeRequest(connection, path, method, body),
  taskIds?: readonly string[],
): Promise<TickTickResult> {
  if (!hasTickTickTargets(connection))
    throw new Error('Сопоставь сферу жизни со списком TickTick.');
  const result: TickTickResult = {
    connection: {
      ...connection,
      links: { ...connection.links },
      dismissed: [...connection.dismissed],
    },
    changes: [],
    warnings: [],
  };
  const projects = new Set<string>();
  for (const task of state.quests) {
    if (
      (taskIds && !taskIds.includes(task.id)) ||
      task.done ||
      !isGoalTask(state, task) ||
      connection.links[task.id]
    )
      continue;
    const project = taskProject(connection, task);
    if (project) projects.add(project);
    else
      result.warnings.push(
        `${task.name}: для сферы «${spheres.find((s) => s.id === task.sphere)?.name ?? task.sphere}» не выбран список TickTick. Задача остаётся здесь.`,
      );
  }
  for (const [id, link] of Object.entries(connection.links)) {
    if (taskIds && !taskIds.includes(id)) continue;
    const project = link.projectId || connection.projectId;
    if (project) projects.add(project);
  }
  for (const projectId of projects) {
    const links = Object.fromEntries(
      Object.entries(connection.links).filter(
        ([id, link]) =>
          (!taskIds || taskIds.includes(id)) &&
          (link.projectId || connection.projectId) === projectId,
      ),
    );
    try {
      const batch = await syncTickTickProject(
        state,
        { ...connection, projectId, links },
        request,
        connection.links,
        taskIds,
      );
      for (const id of Object.keys(links)) delete result.connection.links[id];
      Object.assign(result.connection.links, batch.connection.links);
      result.connection.dismissed = [
        ...new Set([
          ...result.connection.dismissed,
          ...batch.connection.dismissed,
        ]),
      ];
      result.changes.push(...batch.changes);
      result.warnings.push(...batch.warnings);
    } catch (error) {
      result.warnings.push(
        `Список TickTick ${projectId}: ${error instanceof Error ? error.message : 'не удалось обновить задачи'}`,
      );
    }
  }
  result.connection.lastSync = new Date().toISOString();
  return result;
}
export function applyTickTickResult(state: GameState, result: TickTickResult) {
  let next = state;
  const warnings = [...result.warnings];
  const rejected = new Map<string, string>();
  for (const change of result.changes) {
    const local = next.quests.find((q) => q.id === change.id);
    if (!local || !isGoalTask(next, local)) continue;
    if (!local.done && localFingerprint(local, next) === change.snapshot) {
      try {
        next = saveTask(next, { ...local, ...remoteFields(change.remote) });
      } catch (error) {
        if (change.previousRemote)
          rejected.set(change.id, change.previousRemote);
        warnings.push(
          `${local.name}: ${error instanceof Error ? error.message : 'проверь сроки цели'}`,
        );
      }
    }
    if (change.remote.status === 2) next = completeQuest(next, local.id);
  }
  const connection = {
    ...result.connection,
    links: { ...result.connection.links },
  };
  for (const [id, link] of Object.entries(connection.links)) {
    const task = next.quests.find((q) => q.id === id);
    if (
      task &&
      result.changes.some((c) => c.id === id) &&
      !warnings.some((w) => w.startsWith(`${task.name}:`))
    )
      connection.links[id] = { ...link, local: localFingerprint(task, next) };
  }
  for (const [id, remote] of rejected)
    if (connection.links[id])
      connection.links[id] = { ...connection.links[id], remote };
  return { state: next, connection, warnings };
}
