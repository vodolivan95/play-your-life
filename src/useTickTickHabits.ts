import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GameState } from './game';
import type { Habit } from './personalQuests';
import type { TickTickManager } from './tickTickContext';
import {
  checkinIdempotencyKey, emptyHabitLinks, MAX_IMPORTED_KEYS, syncRange, validateHabitLinks,
} from './ticktickHabits';
import type { HabitLink, HabitLinksState, HabitSection, RemoteCheckin, RemoteHabit } from './ticktickHabits';
import {
  afterAttempt, dueOps, exportedThrough, externalDays, findConflicts, importCandidates, importHabit, pendingExports, reconcileLinks, retryAll,
} from './ticktickHabitsSync';
import type { ExportOp, HabitConflict, ImportCandidate } from './ticktickHabitsSync';

export type HabitImportChoice = { id: string; sphere: string };
export type TickTickHabitsApi = {
  connected: boolean;
  busy: boolean;
  message: string;
  /** Код для диагностики, например TICKTICK_AUTH_REQUIRED. Без стека и технических подробностей. */
  code: string;
  loaded: boolean;
  candidates: ImportCandidate[];
  /** Привычки TickTick как они есть, для показа полей (цель в днях, дата начала, напоминания) у связанных привычек. */
  remote: RemoteHabit[];
  sections: HabitSection[];
  links: HabitLinksState;
  linksDirty: boolean;
  /** Локально выполненные отметки, ещё не отправленные в TickTick. */
  waiting: number;
  failed: number;
  conflicts: HabitConflict[];
  /** Дни, импортированные из TickTick, по локальным привычкам (только для календаря и серий). */
  external: Map<string, string[]>;
  lastSyncAt: string;
  load: () => Promise<void>;
  refreshCheckins: () => Promise<void>;
  importHabits: (choices: HabitImportChoice[], lookbackDays: number) => Promise<void>;
  retry: () => void;
  resolveConflict: (conflict: HabitConflict) => Promise<void>;
  unlink: (localId: string) => Promise<void>;
  saveSectionMap: (sectionMap: Record<string, string>) => Promise<void>;
};

const storageKeys = (owner: string) => ({ queue: `pyl:tthabits:${owner}:queue`, links: `pyl:tthabits:${owner}:links` });
function readJson<T>(key: string, fallback: T): T {
  try { const value = JSON.parse(localStorage.getItem(key) ?? 'null'); return value ?? fallback; } catch { return fallback; }
}
function readLinks(key: string): { links: HabitLinksState; dirty: boolean } {
  const stored = readJson<{ links?: unknown; dirty?: unknown } | null>(key, null);
  try { if (stored?.links) return { links: validateHabitLinks(stored.links), dirty: stored.dirty === true }; } catch { /* повреждённое кэширование не даёт доступа */ }
  return { links: emptyHabitLinks(), dirty: false };
}
function readQueue(key: string): ExportOp[] {
  const raw = readJson<unknown>(key, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter((op): op is ExportOp => !!op && typeof op.key === 'string' && typeof op.localId === 'string' && typeof op.ticktickHabitId === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(op.day) && Number.isFinite(op.value) && Number.isFinite(op.goal)).slice(0, 500)
    .map((op) => ({ ...op, attempts: Number(op.attempts) || 0, nextAt: Number(op.nextAt) || 0, status: op.status === 'failed' ? 'failed' : 'pending' }));
}
export function describeError(error: unknown): { message: string; code: string } {
  const code = typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : '';
  return { message: error instanceof Error ? error.message : 'Не удалось выполнить действие.', code };
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export default function useTickTickHabits(manager: TickTickManager | null, state: GameState, onChange: Dispatch<SetStateAction<GameState>>, ownerId: string, today: string): TickTickHabitsApi {
  const keys = storageKeys(ownerId);
  const connected = Boolean(manager?.connected);
  const [remote, setRemote] = useState<RemoteHabit[]>([]);
  const [sections, setSections] = useState<HabitSection[]>([]);
  const [initial] = useState(() => readLinks(keys.links));
  const [links, setLinks] = useState<HabitLinksState>(initial.links);
  const [linksDirty, setLinksDirty] = useState(initial.dirty);
  const [checkins, setCheckins] = useState<RemoteCheckin[]>([]);
  const [queue, setQueue] = useState<ExportOp[]>(() => readQueue(keys.queue));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState('');
  const working = useRef(false);
  const sending = useRef(false);
  const latest = useRef({ manager, state, links, linksDirty, queue, connected, today });
  useEffect(() => { latest.current = { manager, state, links, linksDirty, queue, connected, today }; }, [manager, state, links, linksDirty, queue, connected, today]);
  useEffect(() => { try { localStorage.setItem(keys.queue, JSON.stringify(queue)); } catch { /* очередь остаётся в памяти */ } }, [queue, keys.queue]);
  useEffect(() => { try { localStorage.setItem(keys.links, JSON.stringify({ links, dirty: linksDirty })); } catch { /* кэш необязателен */ } }, [links, linksDirty, keys.links]);

  const request = <T,>(path: string, method = 'GET', data?: unknown) => {
    const current = latest.current.manager;
    return current ? current.request<T>(path, method, data) : Promise.reject(new Error('TickTick не подключён.'));
  };
  const fail = (error: unknown) => { const e = describeError(error); setMessage(e.message); setCode(e.code); };
  const ok = (text: string) => { setMessage(text); setCode(''); };

  /** Сохранение связей на сервере. При ошибке связи остаются в браузере с пометкой «не сохранено» и повторяются позже. */
  async function saveLinks(next: HabitLinksState): Promise<boolean> {
    setLinks(next); setLinksDirty(true);
    try {
      const saved = validateHabitLinks(await request('/habits/links', 'PUT', next));
      setLinks(saved); setLinksDirty(false);
      return true;
    } catch (error) { fail(error); return false; }
  }
  async function fetchCheckins(l: HabitLinksState, ids: string[], from: string, to: string): Promise<RemoteCheckin[]> {
    if (!ids.length) return [];
    const result: RemoteCheckin[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const data = await request<{ items: RemoteCheckin[] }>(`/habits/checkins?from=${from}&to=${to}&habitIds=${ids.slice(i, i + 100).map(encodeURIComponent).join(',')}`);
      if (!Array.isArray(data?.items)) throw new Error('TickTick не вернул историю отметок.');
      result.push(...data.items);
    }
    void l;
    return result;
  }
  async function guarded(fn: () => Promise<void>) {
    if (working.current || !latest.current.connected) return;
    working.current = true; setBusy(true);
    try { await fn(); } catch (error) { fail(error); } finally { working.current = false; setBusy(false); }
  }

  async function load() {
    await guarded(async () => {
      const [list, server] = await Promise.all([
        request<{ items: RemoteHabit[]; sections: HabitSection[] }>('/habits'),
        request<unknown>('/habits/links'),
      ]);
      if (!Array.isArray(list?.items) || !Array.isArray(list?.sections)) throw new Error('TickTick не вернул список привычек.');
      let current = validateHabitLinks(server);
      // Несохранённые связи этого браузера не теряются: берём их, но с актуальной ревизией сервера.
      if (latest.current.linksDirty) current = { ...latest.current.links, revision: current.revision };
      const habitIds = new Set((latest.current.state.habits ?? []).map((h) => h.id));
      // Удалена локальная привычка — удаляется только связь, привычка в TickTick остаётся.
      const pruned: Record<string, HabitLink> = Object.fromEntries(Object.entries(current.links).filter(([id]) => habitIds.has(id)));
      let next: HabitLinksState = reconcileLinks({ ...current, links: pruned }, list.items);
      setRemote(list.items); setSections(list.sections);
      const range = syncRange(latest.current.today, next.lookbackDays);
      const active = Object.values(next.links).filter((l) => l.status === 'active').map((l) => l.ticktickHabitId);
      setCheckins(await fetchCheckins(next, active, range.from, range.to));
      const now = new Date().toISOString();
      next = { ...next, lastSync: now };
      setLastSyncAt(now);
      if (!same(next.links, current.links) || Object.keys(pruned).length !== Object.keys(current.links).length || latest.current.linksDirty) await saveLinks(next);
      else setLinks(next);
      setLoaded(true);
      ok('Привычки TickTick обновлены.');
    });
  }
  async function refreshCheckins() {
    await guarded(async () => {
      const l = latest.current.links;
      const range = syncRange(latest.current.today, l.lookbackDays);
      const active = Object.values(l.links).filter((link) => link.status === 'active').map((link) => link.ticktickHabitId);
      setCheckins(await fetchCheckins(l, active, range.from, range.to));
      setLastSyncAt(new Date().toISOString());
      ok('Отметки из TickTick обновлены.');
    });
  }
  async function importHabits(choices: HabitImportChoice[], lookbackDays: number) {
    await guarded(async () => {
      if (!choices.length) throw new Error('Выберите привычки для импорта.');
      const before = latest.current.links;
      const range = syncRange(latest.current.today, lookbackDays);
      const picked = choices.map((c) => ({ choice: c, candidate: importCandidates(remote, before, sections).find((x) => x.remote.ticktickHabitId === c.id) }));
      if (picked.some((p) => !p.candidate)) throw new Error('Список привычек устарел. Обновите его и повторите.');
      const items = await fetchCheckins(before, choices.map((c) => c.id), range.from, range.to);
      const imported = new Set(before.imported);
      let working = latest.current.state;
      const added: Habit[] = [];
      const nextLinks: Record<string, HabitLink> = { ...before.links };
      let checkinCount = 0;
      for (const { choice, candidate } of picked) {
        const result = importHabit(working, candidate!, choice.sphere, ownerId, range, items, imported);
        working = result.state;
        added.push(working.habits!.find((h) => h.id === result.localId)!);
        nextLinks[result.localId] = result.link;
        for (const key of result.importedKeys) imported.add(key);
        checkinCount += result.importedKeys.length;
      }
      // Добавляются только новые привычки: награды, монеты и отметки экономики не затрагиваются.
      onChange((current) => ({ ...current, habits: [...(current.habits ?? []), ...added.filter((h) => !(current.habits ?? []).some((x) => x.id === h.id))] }));
      setCheckins((old) => [...old, ...items]);
      const now = new Date().toISOString();
      setLastSyncAt(now);
      const saved = await saveLinks({ ...before, links: nextLinks, imported: [...imported].slice(-MAX_IMPORTED_KEYS), lookbackDays, lastSync: now });
      ok(`Импортировано привычек: ${added.length}, отметок истории: ${checkinCount}.${saved ? '' : ' Связи пока не сохранены на сервере: повторю автоматически.'}`);
    });
  }
  function retry() { setQueue((q) => retryAll(q, Date.now())); setMessage('Повторяю отправку отметок в TickTick.'); setCode(''); }
  async function resolveConflict(conflict: HabitConflict) {
    await guarded(async () => {
      const habit = latest.current.state.habits?.find((h) => h.id === conflict.localId);
      if (!habit) throw new Error('Привычка не найдена.');
      // «Оставить выполнено»: ключ отличается от ключа обычной отправки, иначе повтор был бы принят за уже выполненный.
      await request('/habits/checkin', 'POST', { ticktickHabitId: conflict.ticktickHabitId, date: conflict.day, value: habit.targetValue, goal: habit.targetValue, completed: true, idempotencyKey: `${checkinIdempotencyKey(conflict.localId, conflict.day, habit.targetValue)}:resolve${Date.now()}` });
      setCheckins((old) => old.map((c) => (c.ticktickHabitId === conflict.ticktickHabitId && c.day === conflict.day ? { ...c, completed: true, value: habit.targetValue, goal: habit.targetValue } : c)));
      ok(`«${conflict.title}»: день оставлен выполненным и отправлен в TickTick.`);
    });
  }
  async function unlink(localId: string) {
    await guarded(async () => {
      const l = latest.current.links;
      const { [localId]: removed, ...rest } = l.links;
      void removed;
      await saveLinks({ ...l, links: rest });
      setQueue((q) => q.filter((op) => op.localId !== localId));
      ok('Связь с TickTick удалена. Привычка и история остались в игре.');
    });
  }
  async function saveSectionMap(sectionMap: Record<string, string>) {
    await guarded(async () => { await saveLinks({ ...latest.current.links, sectionMap }); ok('Соответствия сохранены.'); });
  }

  // Первая загрузка после подключения.
  useEffect(() => {
    if (!connected) return;
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);
  // Новые локальные отметки связанных привычек ставятся в очередь; локальное действие не откатывается при сбое сети.
  useEffect(() => {
    const timer = setTimeout(() => {
      const current = latest.current;
      const fresh = pendingExports(current.state, current.links, current.queue, Date.now());
      if (fresh.length) setQueue((q) => [...q, ...fresh.filter((op) => !q.some((x) => x.key === op.key))]);
    }, 0);
    return () => clearTimeout(timer);
  }, [state.habitCompletions, state.habits, links]);
  // Отправка очереди: до трёх автоматических попыток с растущей паузой, затем отметка остаётся в очереди.
  useEffect(() => {
    const send = async () => {
      const current = latest.current;
      if (sending.current || !current.connected || !navigator.onLine || current.linksDirty) return;
      const op = dueOps(current.queue, Date.now())[0];
      if (!op) return;
      sending.current = true;
      let sent = false;
      try {
        await request('/habits/checkin', 'POST', { ticktickHabitId: op.ticktickHabitId, date: op.day, value: op.value, goal: op.goal, completed: true, idempotencyKey: op.key });
        sent = true;
      } catch (error) {
        const e = describeError(error);
        if (e.code) setCode(e.code);
      }
      const next = afterAttempt(op, sent, Date.now());
      setQueue((q) => q.flatMap((x) => (x.key !== op.key ? [x] : next ? [next] : [])));
      if (sent) {
        const link = latest.current.links.links[op.localId];
        if (link) { setLinks((l) => ({ ...l, links: { ...l.links, [op.localId]: exportedThrough(l.links[op.localId] ?? link, op.day) } })); setLinksDirty(true); }
        setLastSyncAt(new Date().toISOString());
      } else if (next?.status === 'failed') setMessage('Локально сохранено, TickTick пока не обновлён.');
      sending.current = false;
    };
    const timer = setInterval(() => void send(), 1500);
    return () => clearInterval(timer);
  }, []);
  // Несохранённые связи (после отправки отметок или сбоя сети) сохраняются в фоне.
  useEffect(() => {
    if (!linksDirty || !connected) return;
    const timer = setTimeout(() => { if (!working.current) void saveLinks(latest.current.links); }, 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linksDirty, connected, links]);
  // Обновление отметок из TickTick раз в пять минут, пока приложение открыто.
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === 'visible' && latest.current.connected && navigator.onLine) void refreshCheckins(); }, 300000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const candidates = useMemo(() => importCandidates(remote, links, sections), [remote, links, sections]);
  const conflicts = useMemo(() => findConflicts(state, links, checkins), [state, links, checkins]);
  const external = useMemo(() => new Map(Object.entries(externalDays(links, checkins, today))), [links, checkins, today]);
  return {
    connected, busy, message, code, loaded, candidates, remote, sections, links, linksDirty, conflicts, external, lastSyncAt,
    waiting: queue.filter((op) => op.status !== 'failed').length,
    failed: queue.filter((op) => op.status === 'failed').length,
    load, refreshCheckins, importHabits, retry, resolveConflict, unlink, saveSectionMap,
  };
}
