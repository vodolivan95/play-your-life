import { completeQuest } from './game.ts';
import type { GameState, Quest } from './game.ts';
import { saveTask } from './planning.ts';
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
export type TickTickLink = {
  remoteId: string;
  local: string;
  remote: string;
  done?: boolean;
};
export type TickTickConnection = {
  url: string;
  key: string;
  projectId: string;
  sphereId: string;
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
    sphereId: 'tasks',
    auto: true,
    deleteRemote: false,
    links: {},
    dismissed: [],
  };
}
export async function bridgeRequest<T>(
  connection: TickTickConnection,
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${connection.url}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${connection.key}`,
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
  imports: Quest[];
  warnings: string[];
};
export async function syncTickTick(
  state: GameState,
  connection: TickTickConnection,
  request: <T>(path: string, method?: string, body?: unknown) => Promise<T> = (
    path,
    method,
    body,
  ) => bridgeRequest(connection, path, method, body),
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
    imports: [],
    warnings: [],
  };
  const remoteTasks = new Map(data.tasks.map((t) => [t.id, t]));
  const claimed = new Set(
    Object.values(connection.links).map((link) => link.remoteId),
  );
  for (const [localId, link] of Object.entries(connection.links)) {
    const local = state.quests.find((q) => q.id === localId);
    const path = `/api/project/${project}/task/${encodeURIComponent(link.remoteId)}`;
    if (!local) {
      if (connection.deleteRemote) {
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
    };
  }
  for (const local of state.quests.filter(
    (q) => !q.done && !connection.links[q.id],
  )) {
    const remote = await request<RemoteTask>('/create', 'POST', {
      ...remotePayload(local, state, connection),
      localId: local.id,
    });
    if (!remote.id) throw new Error('TickTick не подтвердил создание задачи.');
    claimed.add(remote.id);
    result.connection.links[local.id] = {
      remoteId: remote.id,
      local: localFingerprint(local, state),
      remote: remoteFingerprint(remote),
    };
    if (remote.status === 2)
      result.changes.push({
        id: local.id,
        snapshot: localFingerprint(local, state),
        remote,
      });
  }
  for (const remote of data.tasks.filter(
    (t) =>
      t.status !== 2 &&
      !claimed.has(t.id) &&
      !result.connection.dismissed.includes(t.id),
  )) {
    const fields = remoteFields(remote);
    const task: Quest = {
      ...fields,
      id: crypto.randomUUID(),
      sphere: connection.sphereId,
      difficulty: 'Medium',
      xp: 20,
      done: false,
    };
    result.imports.push(task);
    result.connection.links[task.id] = {
      remoteId: remote.id,
      local: localFingerprint(task, state),
      remote: remoteFingerprint(remote),
    };
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
    if (!local) continue;
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
  for (const task of result.imports) {
    if (next.quests.some((q) => q.id === task.id)) continue;
    try {
      next = saveTask(next, task);
    } catch (error) {
      warnings.push(
        `${task.name}: ${error instanceof Error ? error.message : 'не удалось добавить задачу'}`,
      );
      delete result.connection.links[task.id];
    }
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
