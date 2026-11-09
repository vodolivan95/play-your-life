import type { Event, GameState, Quest } from './game.ts';
import { validDependencyIds } from './taskDependencies.ts';

export type TaskPlanning = {
  dependencyIds?: string[];
  mainDay?: string;
  inbox?: boolean;
  archivedAt?: string;
  workflow?: 'planned' | 'ready' | 'doing' | 'waiting';
  important?: boolean;
  urgent?: boolean;
};
export type PlanningSettings = {
  dailyMinutes: number;
  weekdays: number[];
  reservePercent: number;
  mainLimit: number;
  moveWarning: number;
  wipLimit: number;
};
/** Классифицированные причины переноса (ТЗ «Этап 2», раздел 5). Необязательны; свободный текст `reason` остаётся рядом, в т.ч. для 'other'. */
export type PostponeReasonCode =
  | 'noTime' | 'priorityChanged' | 'harderThanExpected' | 'missingInfo'
  | 'waitingForSomeone' | 'urgentCameUp' | 'noOpportunity' | 'notRelevant' | 'other';
export const postponeReasons: readonly { code: PostponeReasonCode; label: string }[] = [
  { code: 'noTime', label: 'Не хватило времени' },
  { code: 'priorityChanged', label: 'Изменились приоритеты' },
  { code: 'harderThanExpected', label: 'Задача оказалась сложнее' },
  { code: 'missingInfo', label: 'Не хватает информации' },
  { code: 'waitingForSomeone', label: 'Жду другого человека' },
  { code: 'urgentCameUp', label: 'Появились срочные дела' },
  { code: 'noOpportunity', label: 'Не было возможности выполнить' },
  { code: 'notRelevant', label: 'Задача временно неактуальна' },
  { code: 'other', label: 'Другая причина' },
];
export type PlanningChange =
  | {
      /** 'schedule' — первое назначение/снятие даты; 'reschedule' — изменился календарный день; 'retime' — день тот же, изменилось только время суток. */
      type: 'schedule' | 'reschedule' | 'retime';
      from?: string; to?: string; reason?: string; reasonCode?: PostponeReasonCode;
      /** Только для 'reschedule': новая дата позже ('forward') или раньше ('backward') прежней. */
      direction?: 'forward' | 'backward';
      /** Перенос обнаружен синхронизацией TickTick у задачи с активным повторением (repeatFlag) — скорее всего, это обычное наступление следующего повтора, а не перенос пользователем (ТЗ, раздел 12). Событие сохраняется для прозрачности, но не считается в основном счётчике и аналитике переносов. */
      auto?: true;
    }
  | { type: 'time'; minutes: number };

export const defaultPlanningSettings: PlanningSettings = {
  dailyMinutes: 480, weekdays: [1, 2, 3, 4, 5], reservePercent: 20,
  mainLimit: 3, moveWarning: 3, wipLimit: 3,
};
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const instant = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
export function validDay(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
export function validTaskPlanning(v: unknown): boolean {
  return v === undefined || (obj(v)
    && Object.keys(v).every((k) => ['dependencyIds', 'mainDay', 'inbox', 'archivedAt', 'workflow', 'important', 'urgent'].includes(k))
    && (v.dependencyIds === undefined || validDependencyIds(v.dependencyIds))
    && (v.mainDay === undefined || validDay(v.mainDay))
    && (v.archivedAt === undefined || instant(v.archivedAt))
    && (v.workflow === undefined || ['planned', 'ready', 'doing', 'waiting'].includes(String(v.workflow)))
    && ['inbox', 'important', 'urgent'].every((k) => v[k] === undefined || typeof v[k] === 'boolean'));
}
export function validPlanningSettings(v: unknown): v is PlanningSettings {
  return obj(v) && Object.keys(v).length === 6
    && integer(v.dailyMinutes, 0, 1440) && integer(v.reservePercent, 0, 90)
    && integer(v.mainLimit, 1, 20) && integer(v.moveWarning, 1, 100) && integer(v.wipLimit, 1, 100)
    && Array.isArray(v.weekdays) && v.weekdays.every((d) => integer(d, 0, 6))
    && new Set(v.weekdays).size === v.weekdays.length;
}
export function validPlanningEvent(e: Record<string, unknown>): boolean {
  const v = e.planningChange;
  if (v === undefined) return true;
  if (!obj(v) || e.kind !== 'planning' || e.xp !== 0 || typeof e.sourceId !== 'string' || !e.sourceId) return false;
  if (v.type === 'time') return Object.keys(v).length === 2 && integer(v.minutes, 1, 43200);
  return ['schedule', 'reschedule', 'retime'].includes(String(v.type))
    && Object.keys(v).every((k) => ['type', 'from', 'to', 'reason', 'reasonCode', 'direction', 'auto'].includes(k))
    && (v.from === undefined || instant(v.from)) && (v.to === undefined || instant(v.to))
    && (v.reason === undefined || (typeof v.reason === 'string' && v.reason.length <= 300))
    && (v.reasonCode === undefined || postponeReasons.some((r) => r.code === v.reasonCode))
    && (v.direction === undefined || (v.type === 'reschedule' && ['forward', 'backward'].includes(String(v.direction))))
    && (v.auto === undefined || (v.type === 'reschedule' && v.auto === true))
    && (v.from !== undefined || v.to !== undefined);
}
export function planningSettings(state: GameState): PlanningSettings {
  return state.planningSettings ?? { ...defaultPlanningSettings, weekdays: [...defaultPlanningSettings.weekdays] };
}
export function planningDay(value?: string): string | undefined {
  if (!value) return undefined;
  if (validDay(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function taskPlanningEvents(state: GameState, id: string): Event[] {
  return state.events.filter((e) => e.sourceId === id && e.planningChange)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
/** Переносы без учёта тех, что синхронизация пометила 'auto' (вероятное наступление следующего повтора TickTick, см. PlanningChange.auto). */
export function moveCount(state: GameState, id: string): number {
  return taskPlanningEvents(state, id).filter((e) => e.planningChange?.type === 'reschedule' && !e.planningChange.auto).length;
}
/** Отдельно — перенос вперёд (TOR 4.2/6.4: именно они считаются «откладыванием»), тоже без 'auto'. */
export function forwardMoveCount(state: GameState, id: string): number {
  return taskPlanningEvents(state, id).filter((e) => e.planningChange?.type === 'reschedule' && !e.planningChange.auto && e.planningChange.direction === 'forward').length;
}
/** Изменения времени в пределах того же дня — отдельная категория по ТЗ, не входит в moveCount. */
export function retimeCount(state: GameState, id: string): number {
  return taskPlanningEvents(state, id).filter((e) => e.planningChange?.type === 'retime').length;
}
export function actualMinutes(state: GameState, id: string): number {
  return taskPlanningEvents(state, id).reduce((sum, e) => sum + (e.planningChange?.type === 'time' ? e.planningChange.minutes : 0), 0);
}
export function planningMetrics(state: GameState): Map<string, { moves: number; minutes: number }> {
  const result = new Map<string, { moves: number; minutes: number }>();
  for (const e of state.events) {
    if (!e.sourceId || !e.planningChange) continue;
    const value = result.get(e.sourceId) ?? { moves: 0, minutes: 0 };
    if (e.planningChange.type === 'time') value.minutes += e.planningChange.minutes;
    if (e.planningChange.type === 'reschedule' && !e.planningChange.auto) value.moves++;
    result.set(e.sourceId, value);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Аналитика переносов и времени (ТЗ «Этап 2», разделы 6 и 8).
// ---------------------------------------------------------------------------
const weekStart = (day: string) => {
  const d = new Date(`${day}T12:00:00`);
  const dow = (d.getDay() + 6) % 7; // понедельник = 0
  d.setDate(d.getDate() - dow);
  return planningDay(d.toISOString())!;
};
function reschedules(state: GameState, ids?: Set<string>) {
  return state.events.filter((e) => e.planningChange?.type === 'reschedule' && !e.planningChange.auto
    && (!ids || (e.sourceId && ids.has(e.sourceId))));
}
export type PostponedTask = { id: string; name: string; sphere: string; moves: number };
export type PostponementAnalytics = {
  totalMoves: number;
  tasksWithMoves: number;
  movesThisWeek: number;
  movesThisMonth: number;
  forwardMoves: number;
  backwardMoves: number;
  averagePerTask: number;
  mostPostponed?: PostponedTask;
  top10: PostponedTask[];
  /** Доля запланированных задач (имевших хотя бы одну известную плановую дату), перенесённых хотя бы раз вперёд. Переносы назад не включаются (ТЗ 6.4). */
  postponementRate?: number;
  /** true, если задач с известной плановой датой меньше scheduledMin — показывать «Недостаточно данных» вместо ставки. */
  insufficientData: boolean;
};
/**
 * `now` — для стабильных тестов; по умолчанию текущий момент.
 * `questIds` — ограничить проектом/этапом/сферой (ТЗ «Этап 2», раздел 9); по умолчанию — все задачи.
 */
export function postponementAnalytics(state: GameState, now = new Date(), questIds?: Iterable<string>): PostponementAnalytics {
  const ids = questIds ? new Set(questIds) : undefined;
  const today = planningDay(now.toISOString())!;
  const weekFrom = weekStart(today);
  const monthFrom = today.slice(0, 7) + '-01';
  const events = reschedules(state, ids);
  const byTask = new Map<string, { moves: number; forward: number }>();
  let movesThisWeek = 0, movesThisMonth = 0, forwardMoves = 0, backwardMoves = 0;
  for (const e of events) {
    if (!e.sourceId) continue;
    const entry = byTask.get(e.sourceId) ?? { moves: 0, forward: 0 };
    entry.moves++;
    const direction = e.planningChange?.type === 'reschedule' ? e.planningChange.direction : undefined;
    if (direction === 'forward') { entry.forward++; forwardMoves++; } else backwardMoves++;
    byTask.set(e.sourceId, entry);
    const day = planningDay(e.date)!;
    if (day >= weekFrom) movesThisWeek++;
    if (day >= monthFrom) movesThisMonth++;
  }
  const tasksById = new Map(state.quests.map((q) => [q.id, q]));
  const top10: PostponedTask[] = [...byTask.entries()]
    .map(([id, v]) => ({ id, name: tasksById.get(id)?.name ?? 'Удалённая задача', sphere: tasksById.get(id)?.sphere ?? 'tasks', moves: v.moves }))
    // Стабильная сортировка при равенстве: по числу переносов, затем по id задачи.
    .sort((a, b) => b.moves - a.moves || a.id.localeCompare(b.id))
    .slice(0, 10);
  // Задачи, у которых когда-либо была известна плановая дата (есть хотя бы одно 'schedule'/'reschedule'/'retime' событие с 'to').
  const scheduledTaskIds = new Set(
    state.events.filter((e) => e.sourceId && (!ids || ids.has(e.sourceId)) && e.planningChange && e.planningChange.type !== 'time' && e.planningChange.to).map((e) => e.sourceId!),
  );
  const postponedForwardTaskIds = new Set([...byTask.entries()].filter(([, v]) => v.forward > 0).map(([id]) => id));
  const MIN_SCHEDULED_FOR_RATE = 5;
  const insufficientData = scheduledTaskIds.size < MIN_SCHEDULED_FOR_RATE;
  return {
    totalMoves: events.length,
    tasksWithMoves: byTask.size,
    movesThisWeek, movesThisMonth, forwardMoves, backwardMoves,
    averagePerTask: byTask.size ? events.length / byTask.size : 0,
    mostPostponed: top10[0],
    top10,
    postponementRate: insufficientData || !scheduledTaskIds.size ? undefined : postponedForwardTaskIds.size / scheduledTaskIds.size,
    insufficientData,
  };
}
export type TimeAnalytics = {
  plannedMinutes: number;
  actualMinutes: number;
  /** Среднее отклонение факт−план по задачам с обоими значениями (минуты; положительное — дольше плана). */
  averageDeviationMinutes?: number;
  /** Точность оценки (Plan Accuracy): среднее по задачам с обоими значениями от 1 − |факт−план|/план, клампится в [0;1]. 1 — оценка точна, 0 — отклонение ≥ 100% плана и больше. Отражает именно точность оценки длительности, а не долю выполненных задач. */
  planAccuracy?: number;
  tasksWithBoth: number;
};
/** `questIds` — ограничить подсчёт конкретным набором задач (сфера/проект/неделя/месяц); по умолчанию — все задачи с историей. */
export function timeAnalytics(state: GameState, questIds?: Iterable<string>): TimeAnalytics {
  const ids = questIds ? new Set(questIds) : undefined;
  let plannedMinutes = 0, actualMinutesTotal = 0, deviationSum = 0, accuracySum = 0, tasksWithBoth = 0;
  for (const task of state.quests) {
    if (ids && !ids.has(task.id)) continue;
    const actual = actualMinutes(state, task.id);
    if (task.estimateMinutes) plannedMinutes += task.estimateMinutes;
    actualMinutesTotal += actual;
    if (task.estimateMinutes && actual) {
      deviationSum += actual - task.estimateMinutes;
      accuracySum += Math.max(0, 1 - Math.abs(actual - task.estimateMinutes) / task.estimateMinutes);
      tasksWithBoth++;
    }
  }
  return {
    plannedMinutes, actualMinutes: actualMinutesTotal,
    averageDeviationMinutes: tasksWithBoth ? deviationSum / tasksWithBoth : undefined,
    planAccuracy: tasksWithBoth ? accuracySum / tasksWithBoth : undefined,
    tasksWithBoth,
  };
}
/** Переносы, обнаруженные в течение календарного месяца 'YYYY-MM' — по дате события (ТЗ 6.2, карточки отчёта месяца). */
export function monthlyMoves(state: GameState, month: string): { moves: number; forward: number } {
  let moves = 0, forward = 0;
  for (const e of state.events) {
    if (e.planningChange?.type !== 'reschedule' || e.planningChange.auto) continue;
    if (!e.date.startsWith(month)) continue;
    moves++;
    if (e.planningChange.direction === 'forward') forward++;
  }
  return { moves, forward };
}
/** Фактическое время, учтённое в течение календарного месяца — по дате записи, а не по дате задачи. */
export function monthlyActualMinutes(state: GameState, month: string): number {
  let sum = 0;
  for (const e of state.events) {
    if (e.planningChange?.type === 'time' && e.date.startsWith(month)) sum += e.planningChange.minutes;
  }
  return sum;
}
/** Операция сохраняется только один раз; дневник использует существующий архив events. */
export function addPlanningEvent(state: GameState, task: Quest, change: PlanningChange, id: string = crypto.randomUUID(), now = new Date()): GameState {
  const event: Event = {
    id, sourceId: task.id, sphere: task.sphere, title: change.type === 'time'
      ? `Учтено ${change.minutes} мин: ${task.name}` : `Плановая дата: ${task.name}`,
    xp: 0, kind: 'planning', date: now.toISOString(), planningChange: change,
    ...(task.goalId ? { goalId: task.goalId } : {}), ...(task.stageId ? { stageId: task.stageId } : {}),
  };
  if (!validPlanningEvent(event as unknown as Record<string, unknown>)) throw new Error('Проверь данные истории планирования.');
  if (state.events.some((e) => e.id === id)) return state;
  if (state.events.length >= 100000) throw new Error('История слишком большая. Скачай резервную копию перед продолжением.');
  return { ...state, events: [event, ...state.events] };
}
export function recordTaskSchedule(state: GameState, old: Quest | undefined, task: Quest, reason?: string, id?: string, reasonCode?: PostponeReasonCode): GameState {
  const from = old?.dueAt ?? old?.startsAt;
  const to = task.dueAt ?? task.startsAt;
  if (!old || from === to) return state;
  const fromDay = from ? planningDay(from) : undefined;
  const toDay = to ? planningDay(to) : undefined;
  // И 'from', и 'to' должны существовать как ранее запланированные даты — иначе это первое
  // назначение или снятие даты ('schedule'), а не перенос (ТЗ 4.2: «первое назначение даты
  // задаче, которая ранее не была запланирована, не считается переносом»).
  const dayChanged = !!from && !!to && fromDay !== toDay;
  const timeOnlyChanged = !!from && !!to && fromDay === toDay;
  const type: PlanningChange['type'] = dayChanged ? 'reschedule' : timeOnlyChanged ? 'retime' : 'schedule';
  const direction: 'forward' | 'backward' | undefined = dayChanged && fromDay && toDay
    ? (toDay > fromDay ? 'forward' : 'backward') : undefined;
  // Open API v1 TickTick не различает «следующий повтор» и ручной перенос одной и той же
  // связанной задачи — обе операции одинаково меняют dueDate того же id. Раз задача несёт
  // repeatFlag, обнаруженный перенос её календарного дня помечается 'auto' и не входит в
  // основной счётчик/аналитику, но остаётся в истории (ТЗ, раздел 12; ограничение описано в
  // docs/planning-system-2.0/STAGE2_IMPLEMENTATION.md).
  const auto: true | undefined = type === 'reschedule' && task.tickTickRepeatFlag ? true : undefined;
  const change: PlanningChange = {
    type,
    ...(from ? { from } : {}), ...(to ? { to } : {}),
    ...(reason?.trim() ? { reason: reason.trim() } : {}),
    ...(reasonCode ? { reasonCode } : {}),
    ...(direction ? { direction } : {}),
    ...(auto ? { auto } : {}),
  };
  return addPlanningEvent(state, task, change, id);
}
