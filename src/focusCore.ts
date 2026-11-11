/**
 * Ядро учёта фокуса — то, что нужно сразу при открытии сайта: чтение записей фокуса из
 * истории, время по задачам, формат и приведение текущей сессии в порядок после слияния
 * сохранений. Остальное (операции таймера и секундомера, показатели этапа, проекта и месяца)
 * — в `focusSessions.ts`, который подгружается вместе с экранами таймера и отчётов.
 * Разделение нужно только ради веса стартового скрипта; `focusSessions.ts` повторно
 * экспортирует всё отсюда, поэтому остальной код может импортировать из него.
 */
import { dateKey, spheres } from './game.ts';
import type { Event, GameState } from './game.ts';
import type { FocusModeId, FocusSegment } from './planningData.ts';

/** Отрезок работы, мс: [начало, конец]. */
export type Interval = [start: number, end: number];
/** Категория для сессий, сфера которых не найдена в справочнике. */
export const NO_SPHERE = 'none';
export const NO_SPHERE_NAME = 'Без сферы';

/** До часа — минуты, дальше — часы и минуты. Округление только здесь, при показе. */
export function formatFocus(seconds: number): string {
  if (!(seconds > 0)) return '0 мин';
  if (seconds < 60) return '< 1 мин';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} ч ${String(m).padStart(2, '0')} мин` : `${h} ч`;
}
/**
 * Приводит текущую сессию в порядок после слияния сохранений с двух устройств (замечание ревью
 * к PR #306). Слияние объединяет массивы отрезков как множества, поэтому, если одну сессию
 * независимо ставили на паузу и продолжали на двух устройствах, получается несколько открытых
 * отрезков и пересечения — такое сохранение не прошло бы проверку. Здесь:
 * - отрезки упорядочиваются, пересекающиеся объединяются;
 * - открытым остаётся только самый поздний; более ранний открытый закрывается началом следующего;
 * - если запись этой сессии уже есть в истории (на другом устройстве её завершили), текущая
 *   сессия убирается — иначе она «воскресла» бы после слияния.
 * Состояние без сессии или с уже правильной сессией возвращается без изменений.
 */
export function normalizeFocusState(state: GameState): GameState {
  const session = state.focusSession;
  if (!session || !Array.isArray(session.segments)) return state;
  const eventId = focusEventId(session.id);
  if (state.events.some((e) => e.id === eventId)) return withoutSession(state);
  const raw = session.segments
    .map((s): Interval => [Date.parse(s.start), s.end === undefined ? Infinity : Date.parse(s.end)])
    .filter(([a, b]) => Number.isFinite(a) && !Number.isNaN(b) && b >= a)
    .sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const lastOpen = raw.reduce((latest, [a, b]) => (b === Infinity ? Math.max(latest, a) : latest), -Infinity);
  const merged: Interval[] = [];
  raw.forEach(([start, rawEnd], i) => {
    const next = raw.slice(i + 1).find(([a]) => a > start);
    const end = rawEnd === Infinity && start !== lastOpen ? (next ? next[0] : start) : rawEnd;
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  });
  const segments: FocusSegment[] = merged.map(([a, b]) => (b === Infinity
    ? { start: new Date(a).toISOString() }
    : { start: new Date(a).toISOString(), end: new Date(b).toISOString() }));
  const same = segments.length === session.segments.length
    && segments.every((s, i) => s.start === session.segments[i].start && s.end === session.segments[i].end);
  return same ? state : { ...state, focusSession: { ...session, segments } };
}

export function withoutSession(state: GameState): GameState {
  if (!state.focusSession) return state;
  const next = { ...state };
  delete next.focusSession;
  return next;
}
export function focusEventId(sessionId: string) {
  return `focus-${sessionId}`;
}
// ───────────────────────── Записи фокуса ─────────────────────────

export type FocusRecord = {
  id: string;
  taskId: string;
  /** Проект, этап и сфера — как были на момент сессии. */
  goalId?: string;
  stageId?: string;
  sphere: string;
  seconds: number;
  /** Нет у секундомера и у времени, внесённого вручную. */
  plannedSeconds?: number;
  pausedSeconds: number;
  startedAt: string;
  endedAt: string;
  mode: FocusModeId | 'manual';
  status: 'completed' | 'interrupted';
  firstAction?: string;
  result?: string;
  /** Отрезки работы, мс. Пусто у записей без сессии — они целиком относятся к дню записи. */
  intervals: Interval[];
};
const sphereIds = new Set(spheres.map((s) => s.id));
function recordOf(e: Event): FocusRecord | undefined {
  const change = e.planningChange;
  if (change?.type !== 'time' || !e.sourceId) return undefined;
  const base = {
    id: e.id, taskId: e.sourceId, sphere: sphereIds.has(e.sphere) ? e.sphere : NO_SPHERE,
    ...(e.goalId ? { goalId: e.goalId } : {}), ...(e.stageId ? { stageId: e.stageId } : {}),
  };
  const s = change.session;
  if (!s) {
    if (!(change.minutes > 0)) return undefined;
    return { ...base, seconds: change.minutes * 60, pausedSeconds: 0, startedAt: e.date, endedAt: e.date, mode: 'manual', status: 'completed', intervals: [], ...(change.comment ? { result: change.comment } : {}) };
  }
  if (!(s.focusedSeconds > 0)) return undefined;
  return {
    ...base, seconds: s.focusedSeconds, ...(s.mode === 'stopwatch' ? {} : { plannedSeconds: s.plannedSeconds }), pausedSeconds: s.pausedSeconds,
    startedAt: s.startedAt, endedAt: s.endedAt, mode: s.mode, status: s.status,
    ...(s.firstAction ? { firstAction: s.firstAction } : {}), ...(s.result ? { result: s.result } : {}),
    intervals: s.segments.map((seg): Interval => [Date.parse(seg.start), Date.parse(seg.end)]),
  };
}
const recordsCache = new WeakMap<Event[], FocusRecord[]>();
/**
 * Все записи фокуса, новые первыми. Результат запоминается для массива событий: пока история
 * не изменилась, повторные вызовы (карточки задач, графики, фильтры) ничего не пересчитывают.
 */
export function focusRecords(state: Pick<GameState, 'events'>): FocusRecord[] {
  const cached = recordsCache.get(state.events);
  if (cached) return cached;
  const records: FocusRecord[] = [];
  for (const e of state.events) {
    const r = recordOf(e);
    if (r) records.push(r);
  }
  records.sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt) || a.id.localeCompare(b.id));
  recordsCache.set(state.events, records);
  return records;
}

export type DaySeconds = { day: string; seconds: number };
const slicesCache = new WeakMap<FocusRecord, DaySeconds[]>();
/**
 * Время записи по календарным дням. Сессия через полночь делится между днями по фактическим
 * отрезкам работы (паузы не входят), а не относится целиком к дате начала (ТЗ, раздел 14).
 * Сумма по дням всегда точно равна времени записи.
 */
export function recordDays(record: FocusRecord): DaySeconds[] {
  const cached = slicesCache.get(record);
  if (cached) return cached;
  let result: DaySeconds[];
  if (!record.intervals.length) {
    result = [{ day: dateKey(new Date(record.endedAt)), seconds: record.seconds }];
  } else {
    const ms = new Map<string, number>();
    for (const [start, end] of record.intervals) {
      let cursor = start;
      while (cursor < end) {
        const d = new Date(cursor);
        const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
        const stop = Math.min(end, midnight > cursor ? midnight : end);
        const key = dateKey(d);
        ms.set(key, (ms.get(key) ?? 0) + (stop - cursor));
        cursor = stop;
      }
    }
    // Целые секунды по дням методом наибольших остатков — чтобы сумма сошлась с записью до секунды.
    const total = [...ms.values()].reduce((a, b) => a + b, 0);
    const parts = [...ms.entries()].map(([day, value]) => {
      const exact = total ? (value / total) * record.seconds : 0;
      return { day, seconds: Math.floor(exact), rest: exact - Math.floor(exact) };
    });
    let left = record.seconds - parts.reduce((sum, p) => sum + p.seconds, 0);
    for (const p of [...parts].sort((a, b) => b.rest - a.rest)) {
      if (left <= 0) break;
      p.seconds += 1;
      left -= 1;
    }
    result = parts.filter((p) => p.seconds > 0).map(({ day, seconds }) => ({ day, seconds })).sort((a, b) => a.day.localeCompare(b.day));
    if (!result.length) result = [{ day: dateKey(new Date(record.endedAt)), seconds: record.seconds }];
  }
  slicesCache.set(record, result);
  return result;
}

export type FocusFilter = {
  sphere?: string;
  goalId?: string;
  stageId?: string;
  taskId?: string;
  /** Календарные дни 'YYYY-MM-DD', включительно. */
  from?: string;
  to?: string;
};
/** Часть записи, пришедшаяся на один день. Одна запись даёт по одному куску на каждый свой день. */
export type FocusSlice = { record: FocusRecord; day: string; seconds: number };

export function focusSlices(state: Pick<GameState, 'events'>, filter: FocusFilter = {}): FocusSlice[] {
  const out: FocusSlice[] = [];
  for (const record of focusRecords(state)) {
    if (filter.sphere !== undefined && record.sphere !== filter.sphere) continue;
    if (filter.goalId !== undefined && record.goalId !== filter.goalId) continue;
    if (filter.stageId !== undefined && record.stageId !== filter.stageId) continue;
    if (filter.taskId !== undefined && record.taskId !== filter.taskId) continue;
    for (const { day, seconds } of recordDays(record)) {
      if (filter.from !== undefined && day < filter.from) continue;
      if (filter.to !== undefined && day > filter.to) continue;
      out.push({ record, day, seconds });
    }
  }
  return out;
}
const taskTotalsCache = new WeakMap<Event[], Map<string, number>>();
/** Суммарный фокус каждой задачи — один проход по истории на все карточки задач. */
export function focusByTask(state: Pick<GameState, 'events'>): Map<string, number> {
  const cached = taskTotalsCache.get(state.events);
  if (cached) return cached;
  const map = new Map<string, number>();
  for (const r of focusRecords(state)) map.set(r.taskId, (map.get(r.taskId) ?? 0) + r.seconds);
  taskTotalsCache.set(state.events, map);
  return map;
}
export const pad = (n: number) => String(n).padStart(2, '0');
export function monthDays(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
/** Фраза для личных итогов месяца (ТЗ, раздел 13.2). Игрок может править и дополнять её сам. */
export function monthFocusSentence(state: Pick<GameState, 'events'>, month: string): string {
  const seconds = focusSlices(state, { from: `${month}-01`, to: `${month}-${pad(monthDays(month))}` }).reduce((sum, s) => sum + s.seconds, 0);
  const [y, m] = month.split('-').map(Number);
  const name = new Date(y, m - 1, 1, 12).toLocaleDateString('ru-RU', { month: 'long' });
  return `За ${name} на проекты и задачи ушло ${formatFocus(seconds)} фокуса.`;
}
