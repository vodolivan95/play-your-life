import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GameState } from './game';
import { applyTickTickResult, bridgeRequest, connectionStorageKey, newConnection, hasTickTickTargets, matchSphereLists, syncTickTick } from './ticktick';
import type { TickTickConnection } from './ticktick';
import { emptyTickTickSettings, validateTickTickSettings } from './ticktickSettings';
import type { TickTickSettings } from './ticktickSettings';
import type { TickTickManager } from './tickTickContext';

function readConnection(storageKey: string): TickTickConnection | null {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (data && typeof data.url === 'string' && /^[a-f0-9]{64}$/.test(data.key) && data.links && Array.isArray(data.dismissed)) {
      newConnection(data.url); // Validate stored origins before forwarding any credential.
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
      try { return { ...newConnection(serverUrl), ...emptyTickTickSettings(), auth: 'firebase' }; }
      catch { /* An invalid deployment setting is shown as unconfigured. */ }
    }
    return null;
  });
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const working = useRef(false);
  const latest = useRef({ state, connection, connected, dirty });
  useEffect(() => { latest.current = { state, connection, connected, dirty }; }, [state, connection, connected, dirty]);
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
  async function sync(taskIds?: readonly string[], automatic = false) {
    const current = latest.current;
    if (working.current || !current.connection || !current.connected || current.dirty || current.state.profile.mode === 'demo') return;
    if (!navigator.onLine) { setStatus('Нет сети. Изменения задач сохранены в игре; обмен продолжится после подключения.'); return; }
    working.current = true; setBusy(true);
    try {
      let c = current.connection;
      if (c.auth === 'firebase') c = { ...c, ...validateTickTickSettings(await request(c, '/settings')) };
      setConnection(c);
      if ((automatic && !c.auto) || !hasTickTickTargets(c)) return;
      const result = await syncTickTick(latest.current.state, c, (path, method, data) => request(c, path, method, data), taskIds);
      const applied = applyTickTickResult(latest.current.state, result);
      const next = c.auth === 'firebase' ? validateTickTickSettings(await request(c, '/settings', 'PUT', settings(applied.connection))) : settings(applied.connection);
      // Preserve edits made while requests were in flight.
      onChange(state => applyTickTickResult(state, result).state);
      setConnection({ ...c, ...next });
      setStatus(applied.warnings.length ? applied.warnings.join('\n') : 'Связанные задачи целей синхронизированы.');
    } catch (error) {
      if (error instanceof Error && error.message.endsWith('(401)')) setConnected(false);
      setStatus(error instanceof Error ? error.message : 'Не удалось синхронизировать.');
    } finally { working.current = false; setBusy(false); }
  }
  async function disconnect() {
    const c = latest.current.connection;
    if (!c) return;
    if (working.current) throw new Error('Дождитесь окончания обмена.');
    working.current = true; setBusy(true);
    try {
      await request(c, '/disconnect', 'POST');
      setConnection(null); setProjects([]); setConnected(false); setDirty(false);
      setStatus('TickTick отключён. Задачи и прогресс в обоих приложениях сохранены.');
    } finally { working.current = false; setBusy(false); }
  }
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
      if (!current.connected) void refresh();
      else if (current.connection.auto) void sync(undefined, true);
    };
    const timer = setInterval(poll, 60000);
    document.addEventListener('visibilitychange', poll); window.addEventListener('online', poll);
    const outcome = location.hash;
    if (outcome.startsWith('#ticktick=')) history.replaceState(null, '', location.pathname + location.search + '#profile');
    if (outcome === '#ticktick=cancelled' || outcome === '#ticktick=failed') queueMicrotask(() => setStatus(outcome.endsWith('cancelled') ? 'Подключение TickTick отменено.' : 'TickTick не подтвердил подключение. Попробуйте снова.'));
    else if (latest.current.connection) void refresh();
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', poll); window.removeEventListener('online', poll); };
    // Each App instance is keyed by the authenticated Firebase UID.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const restoreBlocked = connected || wasActivated(connection);
  return { connection, status, busy, projects, connected, signedIn, dirty, restoreBlocked, configure, refresh, sync, save, disconnect,
    update: patch => { if (!working.current) { setConnection(c => c ? { ...c, ...patch } : c); setDirty(true); } },
    suggest: () => { const c = latest.current.connection; if (c && !working.current) { setConnection({ ...c, sphereLists: matchSphereLists(projects, c.sphereLists) }); setDirty(true); } },
  };
}
