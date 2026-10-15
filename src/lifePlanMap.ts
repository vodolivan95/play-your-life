import type { GameState } from './game.ts';
import { monthKey } from './monthlyFocus.ts';

export const MAX_KEY_SPHERES = 3;
export type PlanMapPeriod = 'month' | 'quarter' | 'year';
export type KeySpheres = { month: string; sphereIds: string[] };

export function validKeySpheres(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.month !== 'string' || !/^\d{4}-\d{2}$/.test(v.month)) return false;
  if (!Array.isArray(v.sphereIds) || v.sphereIds.length > MAX_KEY_SPHERES) return false;
  if (!v.sphereIds.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 40)) return false;
  return new Set(v.sphereIds).size === v.sphereIds.length;
}

/** Ключевые сферы текущего месяца. Выбор прошлого месяца не переносится. */
export function keySphereIds(state: GameState, now: Date = new Date()): string[] {
  const keys = state.keySpheres;
  return keys && keys.month === monthKey(now) ? keys.sphereIds : [];
}

/** Добавляет или убирает сферу из ключевых (не больше трёх). */
export function toggleKeySphere(
  state: GameState,
  sphereId: string,
  known: string[],
  now: Date = new Date(),
): GameState {
  if (!known.includes(sphereId)) throw new Error('Такой сферы нет.');
  const month = monthKey(now);
  const current = keySphereIds(state, now);
  if (current.includes(sphereId))
    return { ...state, keySpheres: { month, sphereIds: current.filter((id) => id !== sphereId) } };
  if (current.length >= MAX_KEY_SPHERES)
    throw new Error('Можно выбрать не больше трёх ключевых сфер.');
  return { ...state, keySpheres: { month, sphereIds: [...current, sphereId] } };
}

export type PlanSpan = {
  id: string;
  kind: 'stage' | 'goal' | 'task';
  name: string;
  sphere: string;
  goalId?: string;
  from: Date;
  to: Date;
};

const DAY = 86_400_000;
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
export function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY);
}
function parse(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : startOfDay(d);
}

/** Все незавершённые отрезки времени: этапы, цели без этапов и задачи с датами. */
export function planSpans(state: GameState): PlanSpan[] {
  const spans: PlanSpan[] = [];
  const add = (
    span: Omit<PlanSpan, 'from' | 'to'>,
    start?: string,
    end?: string,
  ) => {
    const from = parse(start ?? end);
    const to = parse(end ?? start);
    if (!from || !to) return;
    spans.push({ ...span, from: from <= to ? from : to, to: from <= to ? to : from });
  };
  for (const goal of state.goals) {
    if (goal.target > 0 && goal.current >= goal.target) continue;
    const stages = (goal.stages ?? []).filter(
      (s) => s.status !== 'completed' && !s.completedAt,
    );
    if (stages.length === 0)
      add(
        { id: goal.id, kind: 'goal', name: goal.name, sphere: goal.sphere, goalId: goal.id },
        goal.startsAt,
        goal.dueAt,
      );
    for (const stage of stages)
      add(
        { id: `${goal.id}:${stage.id}`, kind: 'stage', name: stage.name, sphere: goal.sphere, goalId: goal.id },
        stage.startsAt ?? goal.startsAt,
        stage.dueAt ?? goal.dueAt,
      );
  }
  for (const quest of state.quests) {
    if (quest.done) continue;
    add(
      { id: quest.id, kind: 'task', name: quest.name, sphere: quest.sphere, goalId: quest.goalId },
      quest.startsAt,
      quest.dueAt,
    );
  }
  return spans;
}

export type PlanColumn = { start: Date; end: Date; label: string };
export type PlanMapRange = { start: Date; end: Date; columns: PlanColumn[]; title: string };

const monthNames = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const monthShort = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/** Границы периода и его столбцы: дни для месяца, недели для квартала, месяцы для года. */
export function planMapRange(period: PlanMapPeriod, anchor: Date): PlanMapRange {
  const a = startOfDay(anchor);
  if (period === 'month') {
    const start = new Date(a.getFullYear(), a.getMonth(), 1);
    const end = new Date(a.getFullYear(), a.getMonth() + 1, 0);
    const columns: PlanColumn[] = [];
    for (let d = new Date(start); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1))
      columns.push({ start: new Date(d), end: new Date(d), label: String(d.getDate()) });
    return { start, end, columns, title: `${monthNames[a.getMonth()]} ${a.getFullYear()}` };
  }
  if (period === 'quarter') {
    const q = Math.floor(a.getMonth() / 3);
    const start = new Date(a.getFullYear(), q * 3, 1);
    const end = new Date(a.getFullYear(), q * 3 + 3, 0);
    const columns: PlanColumn[] = [];
    let cursor = new Date(start);
    while (cursor <= end) {
      const weekEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 6);
      const last = weekEnd > end ? new Date(end) : weekEnd;
      columns.push({ start: new Date(cursor), end: last, label: `${cursor.getDate()} ${monthShort[cursor.getMonth()]}` });
      cursor = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
    }
    return { start, end, columns, title: `${q + 1} квартал ${a.getFullYear()}` };
  }
  const start = new Date(a.getFullYear(), 0, 1);
  const end = new Date(a.getFullYear(), 11, 31);
  const columns: PlanColumn[] = monthShort.map((label, m) => ({
    start: new Date(a.getFullYear(), m, 1),
    end: new Date(a.getFullYear(), m + 1, 0),
    label,
  }));
  return { start, end, columns, title: `${a.getFullYear()} год` };
}

export function shiftAnchor(period: PlanMapPeriod, anchor: Date, amount: number): Date {
  const a = startOfDay(anchor);
  const months = period === 'month' ? 1 : period === 'quarter' ? 3 : 12;
  return new Date(a.getFullYear(), a.getMonth() + amount * months, 1);
}

function overlaps(span: PlanSpan, start: Date, end: Date): boolean {
  return span.from <= end && span.to >= start;
}

export type PlanMap = {
  range: PlanMapRange;
  spans: PlanSpan[];
  /** Нагрузка по столбцам: общая и по сферам. */
  load: number[];
  bySphere: Record<string, number[]>;
  peak: { index: number; value: number } | null;
  /** Доля сфер в периоде: число отрезков. */
  balance: { sphere: string; count: number; share: number }[];
  /** Свободные окна: подряд идущие дни без нагрузки не раньше «сегодня». */
  freeWindows: { start: Date; end: Date; days: number }[];
};

export function buildPlanMap(
  state: GameState,
  period: PlanMapPeriod,
  anchor: Date,
  sphereIds: string[],
  today: Date = new Date(),
): PlanMap {
  const range = planMapRange(period, anchor);
  const spans = planSpans(state).filter((s) => overlaps(s, range.start, range.end));
  const bySphere: Record<string, number[]> = {};
  for (const id of sphereIds) bySphere[id] = range.columns.map(() => 0);
  const load = range.columns.map(() => 0);
  range.columns.forEach((col, i) => {
    for (const span of spans) {
      if (!overlaps(span, col.start, col.end)) continue;
      load[i] += 1;
      (bySphere[span.sphere] ??= range.columns.map(() => 0))[i] += 1;
    }
  });
  let peak: PlanMap['peak'] = null;
  load.forEach((value, index) => {
    if (value > 0 && (!peak || value > peak.value)) peak = { index, value };
  });
  const counts = new Map<string, number>();
  for (const span of spans) counts.set(span.sphere, (counts.get(span.sphere) ?? 0) + 1);
  const total = spans.length;
  const balance = sphereIds.map((sphere) => ({
    sphere,
    count: counts.get(sphere) ?? 0,
    share: total ? (counts.get(sphere) ?? 0) / total : 0,
  }));
  // Свободные окна считаем по дням периода, начиная с сегодняшнего.
  const from = startOfDay(today) > range.start ? startOfDay(today) : range.start;
  const freeWindows: PlanMap['freeWindows'] = [];
  let run: Date | null = null;
  const days = dayDiff(range.start, range.end);
  for (let i = 0; i <= days + 1; i++) {
    const day = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate() + i);
    const free = i <= days && day >= from && !spans.some((s) => overlaps(s, day, day));
    if (free && !run) run = day;
    if (!free && run) {
      const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1);
      const length = dayDiff(run, end) + 1;
      if (length >= 2) freeWindows.push({ start: run, end, days: length });
      run = null;
    }
  }
  freeWindows.sort((a, b) => b.days - a.days || a.start.getTime() - b.start.getTime());
  return { range, spans, load, bySphere, peak, balance, freeWindows: freeWindows.slice(0, 4) };
}

/** Позиция отрезка на шкале периода в процентах. */
export function spanPlacement(span: PlanSpan, range: PlanMapRange): { left: number; width: number } {
  const total = dayDiff(range.start, range.end) + 1;
  const from = span.from < range.start ? range.start : span.from;
  const to = span.to > range.end ? range.end : span.to;
  const left = (dayDiff(range.start, from) / total) * 100;
  const width = Math.max(((dayDiff(from, to) + 1) / total) * 100, 1.5);
  return { left, width };
}
