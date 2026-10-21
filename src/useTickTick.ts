import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GameState } from './game';
import type { HeldRemovals, RemoteTask, SyncOptions } from './ticktick';
import { applyTickTickResult, bridgeRequest, connectionStorageKey, describeHeldRemovals, isNotFound, newConnection, hasTickTickTargets, matchSphereLists, summarizeHeldRemovals, syncTickTick } from './ticktick';
import type { TickTickConnection } from './ticktick';
import { emptyTickTickSettings, validateTickTickSettings } from './ticktickSettings';
import type { TickTickSettings } from './ticktickSettings';
import type { TickTickManager } from './tickTickContext';
import { acceptIncomingTask, dismissIncomingTask, findIncomingTasks, mappedProjectIds } from './ticktickInbox';
import type { IncomingChoice, IncomingTask } from './ticktickInbox';

/** Частота фоновой проверки изменений в TickTick, пока вкладка видима. */
const TICKTICK_SYNC_INTERVAL_MS = 10_000;

function readConnection(storageKey: string): TickTickConnection | null {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (data && typeof data.url === 'string' && /^[a-f0-9]{64}$/.test(data.key) && data.links && Array.isArray(data.dismissed)) {
      newConnection(data.url); // Validate stored origins before forwarding any credential.
      // The first account release did not store the activation flag. Its saved revision
      // or mappings prove prior setup even when no task has been linked yet.
      if (data.auth === 'firebase' && data.activated === undefined) {
        data.activated = Boolean(data.revision > 0 || Object.values(data.sphereLists ?? {}).some(Boolean) || Object.keys(data.links).length || data.lastSync);
      }
      return data;
    }
  } catch { /* Invalid or unavailable storage never grants access. */ }
  return null;
}
function settings(c: TickTickConnection): TickTickSettings {
  return { sphereLists: c.sphereLists ?? {}, auto: c.auto, deleteRemote: c.deleteRemote, links: c.links, dismissed: c.dismissed, lastSync: c.lastSync, revision: c.revision ?? 0 };
}
function wasActivated(c: TickTickConnection | null) {
  return Boolean(c && (c.activated || c.auth !== 'firebase' || Object.keys(c.links).length));
}
export default function useTickTick(state: GameState, onChange: Dispatch<SetStateAction<GameState>>, userId?: string, getToken?: () => Promise<string>): TickTickManager {
  const storageKey = userId ? `${connectionStorageKey}:${userId}` : connectionStorageKey;
  const serverUrl = import.meta.env.VITE_TICKTICK_BRIDGE_URL?.trim() ?? '';
  const signedIn = Boolean(userId && getToken);
  const [connection, setConnection] = useState<TickTickConnection | null>(() => {
    const stored = readConnection(storageKey);
    if (stored) return stored;
    if (signedIn && serverUrl) {
      try { return { ...newConnection(serverUrl), ...emptyTickTickSettings(), auth: 'firebase', activated: false }; }
      catch { /* An invalid deployment setting is shown as unconfigured. */ }
    }
    return null;
  });
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const inboxKey = `${storageKey}:inbox`;
  const [incoming, setIncoming] = useState<IncomingTask[]>(() => {
    try { const raw = JSON.parse(localStorage.getItem(inboxKey) ?? '[]'); return Array.isArray(raw) ? raw as IncomingTask[] : []; } catch { return []; }
  });
  useEffect(() => { try { localStorage.setItem(inboxKey, JSON.stringify(incoming)); } catch { /* кэш необязателен */ } }, [incoming, inboxKey]);
  const [inboxBusy, setInboxBusy] = useState(false);
  const [inboxNew, setInboxNew] = useState(0);
  const [inboxError, setInboxError] = useState('');
  const working = useRef(false);
  const recoveryPending = useRef(false);
  const latest = useRef({ state, connection, connected, dirty, incoming: [] as IncomingTask[] });
  useEffect(() => { latest.current = { state, connection, connected, dirty, incoming }; }, [state, connection, connected, dirty, incoming]);
  useEffect(() => {
    try {
      if (connection) localStorage.setItem(storageKey, JSON.stringify(connection));
      else localStorage.removeItem(storageKey);
    } catch { queueMicrotask(() => setStatus('Браузер не сохраняет настройки подключения.')); }
  }, [connection, storageKey]);
  const request = <T,>(c: TickTickConnection, path: string, method = 'GET', data?: unknown) => bridgeRequest<T>(c, path, method, data, getToken);
  async function configure(url: string) {
    if (!signedIn) throw new Error('Войдите в аккаунт PLAY YOUR LIFE, чтобы подключить личный TickTick.');
    if (working.current) return;
    working.current = true; setBusy(true);
    try {
      const c: TickTickConnection = { ...newConnection(url.trim()), ...emptyTickTickSettings(), auth: 'firebase', activated: latest.current.connected || wasActivated(latest.current.connection) };
      localStorage.setItem(storageKey, JSON.stringify(c));
      setConnection(c); setConnected(false); setDirty(false);
      const result = await request<{ url: string }>(c, '/authorize', 'POST');
      const target = new URL(result.url);
      if (target.origin !== 'https://ticktick.com' || target.pathname !== '/oauth/authorize') throw new Error('Сервер вернул некорректную ссылку TickTick.');
      window.location.assign(target.toString());
    } finally { working.current = false; setBusy(false); }
  }
  async function refresh() {
    const c = latest.current.connection;
    if (!c || working.current) return;
    working.current = true; setBusy(true);
    try {
      const check = await request<{ connected: boolean }>(c, '/status');
      recoveryPending.current = false;
      const cloud = c.auth === 'firebase' ? validateTickTickSettings(await request(c, '/settings')) : settings(c);
      if (!check.connected) {
        setConnected(false); setProjects([]); setConnection({ ...c, ...cloud }); setDirty(false);
        setStatus('Аккаунт TickTick не подключён или доступ истёк. Нажмите «Подключить TickTick».');
        return;
      }
      const result = await request<{ id: string; name: string; kind?: string }[]>(c, '/api/project');
      if (!Array.isArray(result) || result.some(p => typeof p.id !== 'string' || typeof p.name !== 'string')) throw new Error('Не удалось прочитать списки TickTick.');
      setProjects(result.filter(p => p.kind !== 'NOTE')); setConnected(true); setDirty(false);
      setConnection({ ...c, ...cloud, activated: true });
      setStatus('Доступ к TickTick подтверждён. Выберите списки для своих сфер и сохраните настройки.');
    } catch (error) {
      setConnected(false); setProjects([]);
      recoveryPending.current = error instanceof TypeError || (error instanceof Error && (error.name === 'TimeoutError' || error.message.includes('network-request-failed') || /\(50[024]\)$/.test(error.message)));
      setStatus(error instanceof Error ? error.message : 'Не удалось проверить подключение.');
    } finally { working.current = false; setBusy(false); }
  }
  async function save() {
    const { connection: c, connected: ready } = latest.current;
    if (!c || !ready || working.current) return;
    working.current = true; setBusy(true);
    try {
      const next = c.auth === 'firebase' ? validateTickTickSettings(await request(c, '/settings', 'PUT', settings(c))) : settings(c);
      setConnection({ ...c, ...next }); setDirty(false);
      setStatus(c.auth === 'firebase' ? 'Настройки сохранены в вашем аккаунте. Они доступны на других устройствах.' : 'Настройки сохранены на этом устройстве.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Не удалось сохранить настройки.');
    } finally { working.current = false; setBusy(false); }
  }
  async function sync(taskIds?: readonly string[], automatic = false, removals?: SyncOptions['removals']) {
    const current = latest.current;
    if (working.current || !current.connection || !current.connected || current.dirty || current.state.profile.mode === 'demo') return;
    if (!navigator.onLine) { setStatus('Нет сети. Изменения задач сохранены в игре; обмен продолжится после подключения.'); return; }
    working.current = true; setBusy(true);
    let held: HeldRemovals | undefined;
    try {
      let c = current.connection;
      if (c.auth === 'firebase') c = { ...c, ...validateTickTickSettings(await request(c, '/settings')) };
      setConnection(c);
      if ((automatic && !c.auto) || !hasTickTickTargets(c)) return;
      const result = await syncTickTick(latest.current.state, c, (path, method, data) => request(c, path, method, data), taskIds, { removals });
      const applied = applyTickTickResult(latest.current.state, result);
      const next = c.auth === 'firebase' ? validateTickTickSettings(await request(c, '/settings', 'PUT', settings(applied.connection))) : settings(applied.connection);
      // Preserve edits made while requests were in flight.
      onChange(state => applyTickTickResult(state, result).state);
      setConnection({ ...c, ...next });
      if (result.stopped?.endsWith('(401)')) setConnected(false);
      held = result.held;
      const lines = [...(held && automatic ? [summarizeHeldRemovals(held)] : []), ...applied.warnings];
      setStatus(lines.length ? lines.join('\n') : 'Связанные задачи целей синхронизированы.');
    } catch (error) {
      if (error instanceof Error && error.message.endsWith('(401)')) setConnected(false);
      setStatus(error instanceof Error ? error.message : 'Не удалось синхронизировать.');
    } finally { working.current = false; setBusy(false); }
    // Массовое удаление без явного согласия не выполняется: при ручном обмене спрашиваем, при автоматическом только сообщаем.
    if (held && !automatic) await sync(taskIds, false, window.confirm(describeHeldRemovals(held)) ? 'confirm' : 'keep');
  }
  // Входящие: новые задачи сопоставленных списков. В игру они попадают только после выбора сферы, цели и этапа.
  async function loadIncoming() {
    const current = latest.current;
    if (working.current || !current.connection || !current.connected || current.dirty || current.state.profile.mode === 'demo') return;
    if (!navigator.onLine) return;
    working.current = true; setBusy(true); setInboxBusy(true); setInboxError('');
    try {
      let c = current.connection;
      if (c.auth === 'firebase') c = { ...c, ...validateTickTickSettings(await request(c, '/settings')) };
      setConnection(c);
      const byProject: Record<string, RemoteTask[]> = {};
      for (const projectId of mappedProjectIds(c)) {
        const data = await request<{ tasks?: RemoteTask[] }>(c, `/api/project/${encodeURIComponent(projectId)}/data`);
        if (!Array.isArray(data?.tasks)) throw new Error('TickTick не вернул список задач.');
        byProject[projectId] = data.tasks;
      }
      const fresh = findIncomingTasks(c, byProject);
      // Подгружаем только новое: уже известные задачи остаются как есть, исчезнувшие из TickTick убираются.
      const known = new Set(latest.current.incoming.map(i => i.remote.id));
      setInboxNew(fresh.filter(i => !known.has(i.remote.id)).length);
      setIncoming(fresh);
    } catch (error) {
      if (error instanceof Error && error.message.endsWith('(401)')) setConnected(false);
      setInboxError(error instanceof Error ? error.message : 'Не удалось получить новые задачи TickTick.');
    } finally { working.current = false; setBusy(false); setInboxBusy(false); }
  }
  // «Обновить»: изменения и удаления в обе стороны только по связанным задачам, затем новые задачи из списков.
  async function refreshAll() { await sync(); await loadIncoming(); }
  async function acceptIncoming(remoteId: string, choice: IncomingChoice): Promise<string> {
    const current = latest.current;
    const item = incoming.find(i => i.remote.id === remoteId);
    if (!item) throw new Error('Задача больше не найдена. Обновите список.');
    if (working.current || !current.connection || !current.connected || current.dirty) throw new Error('Дождитесь окончания обмена или сохраните настройки.');
    working.current = true; setBusy(true);
    try {
      let c = current.connection;
      if (c.auth === 'firebase') c = { ...c, ...validateTickTickSettings(await request(c, '/settings')) };
      const taskId = crypto.randomUUID();
      // Проверка и расчёт без изменений: при ошибке (например, сроки цели) ничего не меняется ни здесь, ни в TickTick.
      const accepted = acceptIncomingTask(latest.current.state, c, item, choice, taskId, userId ?? 'local');
      // Метка PYL в заметке TickTick защищает от копий, даже если сохранение связи прервётся.
      if (accepted.remoteUpdate) await request(c, `/api/task/${encodeURIComponent(item.remote.id)}`, 'POST', accepted.remoteUpdate);
      onChange(state => { try { return acceptIncomingTask(state, c, item, choice, taskId, userId ?? 'local').state; } catch { return state; } });
      setIncoming(list => list.filter(i => i.remote.id !== remoteId));
      try {
        const next = c.auth === 'firebase' ? validateTickTickSettings(await request(c, '/settings', 'PUT', settings(accepted.connection))) : settings(accepted.connection);
        setConnection({ ...c, ...next });
        return `Задача «${accepted.task.name}» добавлена в игру и связана с TickTick.`;
      } catch (error) {
        // Задача уже в игре. Оставляем связь здесь и приостанавливаем обмен, чтобы не создать копию.
        setConnection(accepted.connection); setDirty(true);
        return `Задача «${accepted.task.name}» добавлена, но связь не сохранена: ${error instanceof Error ? error.message : 'нет ответа сервера'}. Нажмите «Сохранить настройки» в профиле.`;
      }
    } finally { working.current = false; setBusy(false); }
  }
  async function dismissIncoming(remoteId: string) {
    const current = latest.current;
    if (working.current || !current.connection || !current.connected || current.dirty) throw new Error('Дождитесь окончания обмена или сохраните настройки.');
    working.current = true; setBusy(true);
    try {
      let c = current.connection;
      if (c.auth === 'firebase') c = { ...c, ...validateTickTickSettings(await request(c, '/settings')) };
      const next = dismissIncomingTask(c, remoteId);
      const saved = c.auth === 'firebase' ? validateTickTickSettings(await request(c, '/settings', 'PUT', settings(next))) : settings(next);
      setConnection({ ...c, ...saved });
      setIncoming(list => list.filter(i => i.remote.id !== remoteId));
    } finally { working.current = false; setBusy(false); }
  }
  async function deleteIncoming(remoteId: string, projectId: string) {
    const current = latest.current;
    if (working.current || !current.connection || !current.connected || current.dirty) throw new Error('Дождитесь окончания обмена или сохраните настройки.');
    working.current = true; setBusy(true);
    try {
      let c = current.connection;
      if (c.auth === 'firebase') c = { ...c, ...validateTickTickSettings(await request(c, '/settings')) };
      // Удаляем саму задачу в TickTick: отсутствующая (уже удалённая) задача — тоже успех.
      try { await request(c, `/api/project/${encodeURIComponent(projectId)}/task/${encodeURIComponent(remoteId)}`, 'DELETE'); }
      catch (error) { if (!isNotFound(error)) throw error; }
      const next = dismissIncomingTask(c, remoteId);
      const saved = c.auth === 'firebase' ? validateTickTickSettings(await request(c, '/settings', 'PUT', settings(next))) : settings(next);
      setConnection({ ...c, ...saved });
      setIncoming(list => list.filter(i => i.remote.id !== remoteId));
    } finally { working.current = false; setBusy(false); }
  }
  async function disconnect() {
    const c = latest.current.connection;
    if (!c) return;
    if (working.current) throw new Error('Дождитесь окончания обмена.');
    working.current = true; setBusy(true);
    try {
      await request(c, '/disconnect', 'POST');
      setConnection(null); setProjects([]); setIncoming([]); setConnected(false); setDirty(false);
      setStatus('TickTick отключён. Задачи и прогресс в обоих приложениях сохранены.');
    } finally { working.current = false; setBusy(false); }
  }
  // Счётчик «на сегодня» в меню зависит от входящих: подгружаем их при подключении, не дожидаясь открытия вкладки.
  useEffect(() => {
    if (!connected || dirty) return;
    const timer = setTimeout(() => void loadIncoming(), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);
  const mappingKey = JSON.stringify(connection?.sphereLists ?? {});
  useEffect(() => {
    if (!connection?.auto || !connected || dirty || state.profile.mode === 'demo') return;
    const timer = setTimeout(() => void sync(undefined, true), 1800);
    return () => clearTimeout(timer);
    // Latest state and connection are supplied by the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.quests, state.goals, connection?.auto, mappingKey, connected, dirty]);
  useEffect(() => {
    const poll = () => {
      const current = latest.current;
      if (document.visibilityState !== 'visible' || !current.connection || current.dirty) return;
      if (!current.connected && recoveryPending.current) void refresh();
      else if (current.connection.auto) void sync(undefined, true);
    };
    const timer = setInterval(poll, TICKTICK_SYNC_INTERVAL_MS);
    document.addEventListener('visibilitychange', poll);
    window.addEventListener('focus', poll);
    window.addEventListener('online', poll);
    const outcome = location.hash;
    if (outcome.startsWith('#ticktick=')) history.replaceState(null, '', location.pathname + location.search + '#profile');
    if (outcome === '#ticktick=cancelled' || outcome === '#ticktick=failed') queueMicrotask(() => setStatus(outcome.endsWith('cancelled') ? 'Подключение TickTick отменено.' : 'TickTick не подтвердил подключение. Попробуйте снова.'));
    else if (latest.current.connection) void refresh();
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
      window.removeEventListener('focus', poll);
      window.removeEventListener('online', poll);
    };
    // Each App instance is keyed by the authenticated Firebase UID.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const restoreBlocked = connected || wasActivated(connection);
  const bridge = <T,>(path: string, method = 'GET', data?: unknown): Promise<T> => {
    const c = latest.current.connection;
    return c ? request<T>(c, path, method, data) : Promise.reject(new Error('TickTick не подключён.'));
  };
  return { request: bridge, connection, status, busy, projects, connected, signedIn, dirty, restoreBlocked, configure, refresh, sync, save, disconnect, incoming, inboxBusy, inboxError, inboxNew, loadIncoming, refreshAll, acceptIncoming, dismissIncoming, deleteIncoming,
    update: patch => { if (!working.current) { setConnection(c => c ? { ...c, ...patch } : c); setDirty(true); } },
    suggest: () => { const c = latest.current.connection; if (c && !working.current) { setConnection({ ...c, sphereLists: matchSphereLists(projects, c.sphereLists) }); setDirty(true); } },
  };
}
