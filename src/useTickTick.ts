import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GameState } from './game';
import {
  applyTickTickResult,
  bridgeRequest,
  connectionStorageKey,
  newConnection,
  hasTickTickTargets,
  matchSphereLists,
  syncTickTick,
} from './ticktick';
import type { TickTickConnection } from './ticktick';
import type { TickTickManager } from './tickTickContext';
function readConnection(storageKey: string): TickTickConnection | null {
  try {
    const data = JSON.parse(
      localStorage.getItem(storageKey) ?? 'null',
    );
    if (
      data &&
      typeof data.url === 'string' &&
      /^[a-f0-9]{64}$/.test(data.key) &&
      data.links &&
      Array.isArray(data.dismissed)
    )
      return data;
  } catch {
    /* A new connection can be configured if storage is unavailable. */
  }
  return null;
}
export default function useTickTick(
  state: GameState,
  onChange: Dispatch<SetStateAction<GameState>>,
  userId?: string,
): TickTickManager {
  const storageKey = userId ? `${connectionStorageKey}:${userId}` : connectionStorageKey;
  const [connection, setConnection] = useState(() => readConnection(storageKey));
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const working = useRef(false);
  const latest = useRef({ state, connection });
  useEffect(() => {
    latest.current = { state, connection };
  }, [state, connection]);
  useEffect(() => {
    try {
      if (connection)
        localStorage.setItem(storageKey, JSON.stringify(connection));
      else localStorage.removeItem(storageKey);
    } catch {
      queueMicrotask(() => setStatus('Браузер не сохраняет подключение.'));
    }
  }, [connection, storageKey]);
  async function configure(url: string) {
    const c =
      connection?.url === url.replace(/\/$/, '')
        ? connection
        : newConnection(url);
    localStorage.setItem(storageKey, JSON.stringify(c));
    setConnection(c);
    const result = await bridgeRequest<{ url: string }>(
      c,
      '/authorize',
      'POST',
    );
    const target = new URL(result.url);
    if (
      target.origin !== 'https://ticktick.com' ||
      target.pathname !== '/oauth/authorize'
    )
      throw new Error('Сервер вернул некорректную ссылку TickTick.');
    window.location.assign(target.toString());
  }
  async function refresh() {
    if (!connection) return;
    setBusy(true);
    try {
      const result = await bridgeRequest<
        { id: string; name: string; kind?: string }[]
      >(connection, '/api/project');
      if (!Array.isArray(result))
        throw new Error('Не удалось прочитать списки TickTick.');
      const taskLists = result.filter((p) => p.kind !== 'NOTE');
      setProjects(taskLists);
      setConnection((current) =>
        current
          ? {
              ...current,
              sphereLists: matchSphereLists(taskLists, current.sphereLists),
            }
          : current,
      );
      setStatus(
        'Аккаунт подключён. Совпадающие списки сопоставлены; проверь выбор для каждой сферы.',
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'Не удалось подключиться.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function sync(taskIds?: readonly string[]) {
    const { state: s, connection: c } = latest.current;
    if (
      working.current ||
      !c ||
      !hasTickTickTargets(c) ||
      s.profile.mode === 'demo'
    )
      return;
    working.current = true;
    setBusy(true);
    try {
      const result = await syncTickTick(s, c, undefined, taskIds);
      const applied = applyTickTickResult(latest.current.state, result);
      onChange(applied.state);
      setConnection((current) =>
        current
          ? {
              ...current,
              links: applied.connection.links,
              dismissed: applied.connection.dismissed,
              lastSync: applied.connection.lastSync,
            }
          : current,
      );
      setStatus(
        applied.warnings.length
          ? applied.warnings.join('\n')
          : 'Подзадачи целей синхронизированы.',
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'Не удалось синхронизировать.',
      );
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  async function disconnect() {
    if (!connection) return;
    if (working.current) throw new Error('Дождись окончания синхронизации.');
    await bridgeRequest(connection, '/disconnect', 'POST');
    setConnection(null);
    setProjects([]);
    setStatus('Подключение отключено. Задачи в обоих приложениях сохранены.');
  }
  // Poll remote changes and debounce local changes while this application is open.
  useEffect(() => {
    if (
      !connection?.auto ||
      !hasTickTickTargets(connection) ||
      state.profile.mode === 'demo'
    )
      return;
    const timer = setTimeout(() => {
      void sync();
    }, 1800);
    return () => clearTimeout(timer); // Ref supplies the latest state without restarting on status updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.quests,
    state.goals,
    connection?.auto,
    connection?.projectId,
    connection?.sphereLists,
  ]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        document.visibilityState === 'visible' &&
        latest.current.connection?.auto
      )
        void sync();
    }, 60000);
    const visible = () => {
      if (
        document.visibilityState === 'visible' &&
        latest.current.connection?.auto
      )
        void sync();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!location.hash.startsWith('#ticktick=')) return;
    const connected = location.hash === '#ticktick=connected';
    history.replaceState(null, '', location.pathname + location.search);
    queueMicrotask(() => {
      setStatus(
        connected
          ? 'Аккаунт подключён. Нажми «Проверить подключение» и сопоставь сферы со списками.'
          : 'Подключение отменено.',
      );
    });
  }, []);
  return {
    connection,
    status,
    busy,
    projects,
    configure,
    refresh,
    sync,
    disconnect,
    update: (patch) => {
      setConnection((c) => (c ? { ...c, ...patch } : c));
    },
  };
}

