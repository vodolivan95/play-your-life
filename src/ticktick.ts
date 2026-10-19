import { completeQuest, removeQuest, spheres } from './game.ts';
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
    deleteRemote: true,
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
/** Передаются задачи целей и свои задачи игрока (одиночные, без цели); системные и привычки — нет. */
export function canSyncTask(state: GameState, task: Quest): boolean {
  return (
    task.tickTickSync !== false &&
    (isGoalTask(state, task) || task.sourceType === 'USER_CREATED')
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
    let code: string | undefined;
    try {
      const error = (await response.json()) as { error?: string; code?: string };
      message = error.error ?? message;
      if (typeof error.code === 'string' && /^[A-Z_]{3,60}$/.test(error.code)) code = error.code;
    } catch {
      /* Empty upstream errors do not prove success. */
    }
    // Код для диагностики не меняет текст и окончание сообщения: другие проверки опираются на «(статус)».
    throw Object.assign(new Error(`${message} (${response.status})`), { code });
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
export function remoteFields(remote: RemoteTask) {
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
export function remoteFingerprint(remote: RemoteTask) {
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
/** Столько удалений в одну сторону за один обмен считаются массовыми: без подтверждения они не выполняются. */
export const MASS_REMOVAL_MIN = 4;
export type SyncOptions = {
  /** Ответ на вопрос о массовом удалении: 'confirm' — выполнить, 'keep' — оставить задачи и разорвать связь. */
  removals?: 'confirm' | 'keep';
};
export type HeldRemovals = {
  /** Задачи, которых больше нет в игре: в TickTick будет удалено столько же. */
  inTickTick: { id: string; name: string }[];
  /** Задачи, которых больше нет в TickTick: в игре будет удалено столько же. */
  inGame: { id: string; name: string }[];
};
export type TickTickResult = {
  connection: TickTickConnection;
  changes: {
    id: string;
    snapshot: string;
    remote: RemoteTask;
    previousRemote?: string;
  }[];
  /** Локальные задачи, удалённые в TickTick. */
  removed: string[];
  warnings: string[];
  /** Массовые удаления, которые ждут подтверждения пользователя; связи с этими задачами не тронуты. */
  held?: HeldRemovals;
  /** Обмен прерван (нет сети, доступ истёк, лимит запросов); всё сделанное до этого сохранено в результате. */
  stopped?: string;
};
function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
function isNotFound(error: unknown) {
  return error instanceof Error && error.message.endsWith('(404)');
}
/** Ошибки, при которых нет смысла продолжать остальные задачи: сеть, доступ, лимит запросов, сбой сервера. */
export function stopsWholeSync(error: unknown) {
  if (error instanceof TypeError) return true;
  const name = (error as { name?: unknown } | null)?.name;
  if (name === 'TimeoutError' || name === 'AbortError') return true;
  return (
    error instanceof Error && /\((401|403|429|5\d\d)\)$/.test(error.message)
  );
}
type Pending = {
  localId: string;
  link: TickTickLink;
  projectId: string;
  name: string;
};
/** Общие сведения одного обмена: удаления откладываются до проверки на массовость. */
type Plan = {
  deletions: Pending[];
  orphans: Pending[];
  /** Где найдена каждая задача TickTick среди сопоставленных списков (перенос между списками — не удаление). */
  elsewhere: Map<string, string>;
  stopped: unknown;
};
function plural(count: number) {
  const tail = count % 100;
  if (tail > 10 && tail < 15) return `${count} задач`;
  if (count % 10 === 1) return `${count} задача`;
  if (count % 10 > 1 && count % 10 < 5) return `${count} задачи`;
  return `${count} задач`;
}
function names(items: { name: string }[]) {
  const shown = items
    .slice(0, 3)
    .map((item) => `«${item.name}»`)
    .join(', ');
  return items.length > 3 ? `${shown} и ещё ${items.length - 3}` : shown;
}
/** Короткая строка для статуса, когда вопрос не задаётся сразу (автоматический обмен). */
export function summarizeHeldRemovals(held: HeldRemovals) {
  const parts = [
    held.inTickTick.length && `в TickTick — ${plural(held.inTickTick.length)}`,
    held.inGame.length && `в игре — ${plural(held.inGame.length)}`,
  ].filter(Boolean);
  return `Обмен остановил массовое удаление (${parts.join(', ')}). Нажмите «Обновить», чтобы подтвердить или отменить.`;
}
export function describeHeldRemovals(held: HeldRemovals) {
  const lines = [
    'Обмен с TickTick остановил массовое удаление, чтобы задачи не пропали по ошибке.',
  ];
  if (held.inTickTick.length)
    lines.push(
      `В игре пропало ${plural(held.inTickTick.length)}: ${names(held.inTickTick)}. Удалить их и в TickTick?`,
    );
  if (held.inGame.length)
    lines.push(
      `В TickTick не найдено ${plural(held.inGame.length)}: ${names(held.inGame)}. Удалить их и в игре?`,
    );
  lines.push(
    '«ОК» — удалить. «Отмена» — оставить всё на месте: удалённое в игре останется в TickTick, а исчезнувшее из TickTick будет создано там заново.',
  );
  return lines.join('\n');
}
async function syncTickTickProject(
  state: GameState,
  connection: TickTickConnection,
  request: <T>(path: string, method?: string, body?: unknown) => Promise<T>,
  allLinks: TickTickConnection['links'],
  taskIds: readonly string[] | undefined,
  tasks: RemoteTask[],
  plan: Plan,
): Promise<TickTickResult> {
  if (!connection.projectId)
    throw new Error('Выбери список TickTick для синхронизации.');
  const project = encodeURIComponent(connection.projectId);
  const result: TickTickResult = {
    connection: {
      ...connection,
      links: { ...connection.links },
      dismissed: [...connection.dismissed],
    },
    changes: [],
    removed: [],
    warnings: [],
  };
  const remoteTasks = new Map(tasks.map((t) => [t.id, t]));
  const syncLink = async (localId: string, link: TickTickLink) => {
    const local = state.quests.find((q) => q.id === localId);
    const path = `/api/project/${project}/task/${encodeURIComponent(link.remoteId)}`;
    if (!local) {
      // Удаление откладывается: решение о массовости принимается по всем спискам сразу.
      plan.deletions.push({
        localId,
        link,
        projectId: connection.projectId,
        name: remoteTasks.get(link.remoteId)?.title ?? 'Задача TickTick',
      });
      return;
    }
    // Existing standalone/imported tasks remain untouched when narrowing the scope.
    if (!canSyncTask(state, local)) {
      result.connection.dismissed.push(link.remoteId);
      delete result.connection.links[localId];
      return;
    }
    // Closed actions remain immutable. Avoid one request per historical quest each minute.
    if (local.done && link.done && !remoteTasks.has(link.remoteId)) return;
    let remote = remoteTasks.get(link.remoteId);
    if (!remote) {
      const moved = plan.elsewhere.get(link.remoteId);
      if (moved && moved !== connection.projectId) {
        // Задачу перенесли в другой сопоставленный список: это не удаление, связь следует за ней.
        result.connection.links[localId] = { ...link, projectId: moved };
        return;
      }
      try {
        remote = await request<RemoteTask>(path);
      } catch (error) {
        // Задача удалена в TickTick: убираем и здесь (выполненные остаются в истории).
        if (isNotFound(error) && !local.done) {
          plan.orphans.push({
            localId,
            link,
            projectId: connection.projectId,
            name: local.name,
          });
          return;
        }
        if (stopsWholeSync(error)) throw error;
        result.warnings.push(
          `${local.name}: ${errorText(error, 'не удалось получить задачу')}. Выполнение и удаление не подтверждены.`,
        );
        return;
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
      tasks.find((t) => t.id === link.remoteId)?.status === 2 ||
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
  };
  for (const [localId, link] of Object.entries(connection.links)) {
    if (plan.stopped) break;
    try {
      await syncLink(localId, link);
    } catch (error) {
      if (stopsWholeSync(error)) {
        plan.stopped = error;
        break;
      }
      // Сбой одной задачи не отменяет уже выполненный обмен остальными.
      const name = state.quests.find((q) => q.id === localId)?.name ?? 'Задача';
      result.warnings.push(
        `${name}: ${errorText(error, 'не удалось обменяться')}. Эта задача будет передана при следующем обмене.`,
      );
    }
  }
  for (const local of state.quests.filter(
    (q) =>
      !q.done &&
      (!taskIds || taskIds.includes(q.id)) &&
      canSyncTask(state, q) &&
      !allLinks[q.id] &&
      taskProject(connection, q) === connection.projectId,
  )) {
    if (plan.stopped) break;
    try {
      const remote = await request<RemoteTask>('/create', 'POST', {
        ...remotePayload(local, state, connection),
        localId: local.id,
      });
      if (!remote.id)
        throw new Error('TickTick не подтвердил создание задачи.');
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
    } catch (error) {
      if (stopsWholeSync(error)) {
        plan.stopped = error;
        break;
      }
      result.warnings.push(
        `${local.name}: ${errorText(error, 'не удалось создать задачу')}. Повтор — при следующем обмене.`,
      );
    }
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
  options: SyncOptions = {},
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
    removed: [],
    warnings: [],
  };
  const projects = new Set<string>();
  for (const task of state.quests) {
    if (
      (taskIds && !taskIds.includes(task.id)) ||
      task.done ||
      !canSyncTask(state, task) ||
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
  const plan: Plan = {
    deletions: [],
    orphans: [],
    elsewhere: new Map(),
    stopped: null,
  };
  // Сначала читаем все списки: так видно, что задача не удалена, а перенесена в другой список.
  const listings = new Map<string, RemoteTask[]>();
  for (const projectId of projects) {
    try {
      const data = await request<{ tasks?: RemoteTask[] }>(
        `/api/project/${encodeURIComponent(projectId)}/data`,
      );
      if (!Array.isArray(data?.tasks))
        throw new Error('TickTick не вернул список задач.');
      listings.set(projectId, data.tasks);
      for (const task of data.tasks) plan.elsewhere.set(task.id, projectId);
    } catch (error) {
      result.warnings.push(
        `Список TickTick ${projectId}: ${errorText(error, 'не удалось обновить задачи')}`,
      );
      if (stopsWholeSync(error)) {
        plan.stopped = error;
        break;
      }
    }
  }
  for (const [projectId, tasks] of listings) {
    if (plan.stopped) break;
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
        tasks,
        plan,
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
      result.removed.push(...batch.removed);
      result.warnings.push(...batch.warnings);
    } catch (error) {
      result.warnings.push(
        `Список TickTick ${projectId}: ${errorText(error, 'не удалось обновить задачи')}`,
      );
    }
  }
  // Задачу, не найденную в своём списке, могли перенести в другой сопоставленный список: это не удаление.
  if (plan.orphans.length && !plan.stopped) {
    const mapped = new Set<string>(
      [
        connection.projectId,
        ...Object.values(connection.sphereLists ?? {}),
        ...Object.values(connection.links).map((link) => link.projectId ?? ''),
      ].filter(Boolean),
    );
    for (const projectId of mapped) {
      if (listings.has(projectId)) continue;
      try {
        const data = await request<{ tasks?: RemoteTask[] }>(
          `/api/project/${encodeURIComponent(projectId)}/data`,
        );
        if (!Array.isArray(data?.tasks)) continue;
        listings.set(projectId, data.tasks);
        for (const task of data.tasks) plan.elsewhere.set(task.id, projectId);
      } catch (error) {
        if (stopsWholeSync(error)) {
          plan.stopped = error;
          break;
        }
      }
    }
    plan.orphans = plan.orphans.filter((item) => {
      const moved = plan.elsewhere.get(item.link.remoteId);
      if (!moved || moved === item.projectId) return true;
      result.connection.links[item.localId] = { ...item.link, projectId: moved };
      return false;
    });
  }
  // Удаления выполняются после всех обменов: массовое удаление требует подтверждения.
  const held: HeldRemovals = { inTickTick: [], inGame: [] };
  const massDeletions = plan.deletions.length >= MASS_REMOVAL_MIN;
  for (const item of plan.deletions) {
    if (plan.stopped) break;
    if (massDeletions && !options.removals) {
      held.inTickTick.push({ id: item.localId, name: item.name });
      continue;
    }
    if (!connection.deleteRemote || (massDeletions && options.removals === 'keep')) {
      result.connection.dismissed.push(item.link.remoteId);
      delete result.connection.links[item.localId];
      continue;
    }
    try {
      await request(
        `/api/project/${encodeURIComponent(item.projectId)}/task/${encodeURIComponent(item.link.remoteId)}`,
        'DELETE',
      );
      delete result.connection.links[item.localId];
    } catch (error) {
      if (isNotFound(error)) {
        result.warnings.push(
          'Удаление в TickTick не подтверждено: задача недоступна.',
        );
        result.connection.dismissed.push(item.link.remoteId);
        delete result.connection.links[item.localId];
      } else if (stopsWholeSync(error)) plan.stopped = error;
      else
        result.warnings.push(
          `${item.name}: ${errorText(error, 'не удалось удалить')}. Удаление будет повторено при следующем обмене.`,
        );
    }
  }
  const massOrphans = plan.orphans.length >= MASS_REMOVAL_MIN;
  for (const item of plan.orphans) {
    if (massOrphans && !options.removals) {
      held.inGame.push({ id: item.localId, name: item.name });
      continue;
    }
    if (massOrphans && options.removals === 'keep') {
      // Связь разрывается, задача остаётся в игре и при следующем обмене создаётся в TickTick заново.
      delete result.connection.links[item.localId];
      continue;
    }
    result.removed.push(item.localId);
    result.connection.dismissed.push(item.link.remoteId);
    delete result.connection.links[item.localId];
  }
  if (held.inTickTick.length || held.inGame.length) result.held = held;
  if (plan.stopped) {
    result.stopped = errorText(plan.stopped, 'Обмен прерван.');
    result.warnings.push(
      `Обмен прерван: ${result.stopped}. Выполненное сохранено, остальное будет передано позже.`,
    );
  }
  result.connection.lastSync = new Date().toISOString();
  return result;
}
export function applyTickTickResult(state: GameState, result: TickTickResult) {
  let next = state;
  for (const id of result.removed ?? []) if (next.quests.some((q) => q.id === id && !q.done)) next = removeQuest(next, id);
  const warnings = [...result.warnings];
  const rejected = new Map<string, string>();
  for (const change of result.changes) {
    const local = next.quests.find((q) => q.id === change.id);
    if (!local || !canSyncTask(next, local)) continue;
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
