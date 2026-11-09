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
      /**
       * Причину изменения даты нельзя достоверно определить (ТЗ «Этап 2 — исправление», раздел 2):
       * задача несёт активное повторение TickTick (repeatFlag), сдвиг вперёд, и этот сдвиг по
       * длительности совпадает с шагом повтора (или шаг повтора невозможно надёжно разобрать из
       * RRULE) — тогда это может быть как автоматическое наступление следующего повтора, так и
       * ручной перенос пользователя, случайно совпавший по длительности с шагом повтора.
       * Перенос назад никогда не помечается так (автоповтор не может сдвигать дату назад), и
       * перенос вперёд на длительность, НЕ совпадающую с шагом повтора, тоже не помечается —
       * такой сдвиг не может быть автоматическим наступлением следующего повтора по определению,
       * значит это достоверный перенос пользователя. Событие сохраняется в истории для
       * прозрачности, но не входит в основной счётчик/аналитику переносов, которые требуют
       * доказанной причины.
       */
      ambiguousRepeat?: true;
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
    && Object.keys(v).every((k) => ['type', 'from', 'to', 'reason', 'reasonCode', 'direction', 'ambiguousRepeat'].includes(k))
    && (v.from === undefined || instant(v.from)) && (v.to === undefined || instant(v.to))
    && (v.reason === undefined || (typeof v.reason === 'string' && v.reason.length <= 300))
    && (v.reasonCode === undefined || postponeReasons.some((r) => r.code === v.reasonCode))
    && (v.direction === undefined || (v.type === 'reschedule' && ['forward', 'backward'].includes(String(v.direction))))
    && (v.ambiguousRepeat === undefined || (v.type === 'reschedule' && v.ambiguousRepeat === true))
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
/** Достоверные переносы — без событий с недоказанной причиной (см. PlanningChange.ambiguousRepeat). */
export function moveCount(state: GameState, id: string): number {
  return taskPlanningEvents(state, id).filter((e) => e.planningChange?.type === 'reschedule' && !e.planningChange.ambiguousRepeat).length;
}
/** Отдельно — перенос вперёд (TOR 4.2/6.4: именно они считаются «откладыванием»), тоже только достоверные. */
export function forwardMoveCount(state: GameState, id: string): number {
  return taskPlanningEvents(state, id).filter((e) => e.planningChange?.type === 'reschedule' && !e.planningChange.ambiguousRepeat && e.planningChange.direction === 'forward').length;
}
/** Изменения времени в пределах того же дня — отдельная категория по ТЗ, не входит в moveCount. */
export function retimeCount(state: GameState, id: string): number {
  return taskPlanningEvents(state, id).filter((e) => e.planningChange?.type === 'retime').length;
}
/** Изменения даты вперёд с недоказанной причиной (см. PlanningChange.ambiguousRepeat) — отдельная категория, не включается ни в moveCount, ни в forwardMoveCount, но не скрывается из истории/аналитики (ТЗ «Этап 2 — исправление», разделы 2 и 4.3). */
export function ambiguousMoveCount(state: GameState, id: string): number {
  return taskPlanningEvents(state, id).filter((e) => e.planningChange?.type === 'reschedule' && e.planningChange.ambiguousRepeat).length;
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
    if (e.planningChange.type === 'reschedule' && !e.planningChange.ambiguousRepeat) value.moves++;
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
/** Последний день (включительно) недели, начинающейся с `weekFrom` (понедельник). */
const weekEnd = (weekFrom: string) => {
  const d = new Date(`${weekFrom}T12:00:00`);
  d.setDate(d.getDate() + 6);
  return planningDay(d.toISOString())!;
};
/** Последний день (включительно) календарного месяца, начинающегося с `monthFrom` ('YYYY-MM-01'). */
const monthEnd = (monthFrom: string) => {
  const d = new Date(`${monthFrom}T12:00:00`);
  d.setMonth(d.getMonth() + 1);
  d.setDate(d.getDate() - 1);
  return planningDay(d.toISOString())!;
};
function reschedules(state: GameState, ids?: Set<string>) {
  return state.events.filter((e) => e.planningChange?.type === 'reschedule' && !e.planningChange.ambiguousRepeat
    && (!ids || (e.sourceId && ids.has(e.sourceId))));
}
export type PostponedTask = { id: string; name: string; sphere: string; moves: number };
export type PostponementAnalytics = {
  /** Всего достоверно классифицированных изменений дат (без недоказанных, см. ambiguousMoves). */
  totalMoves: number;
  tasksWithMoves: number;
  movesThisWeek: number;
  movesThisMonth: number;
  forwardMoves: number;
  backwardMoves: number;
  /** Изменения даты вперёд у повторяющихся задач TickTick с недоказанной причиной — ни автоматическое наступление следующего повтора, ни ручной перенос не доказаны (ТЗ «Этап 2 — исправление», раздел 2). Не входят в totalMoves/forwardMoves и не скрыты — показываются отдельно. */
  ambiguousMoves: number;
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
  const weekTo = weekEnd(weekFrom);
  const monthFrom = today.slice(0, 7) + '-01';
  const monthTo = monthEnd(monthFrom);
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
    // Верхняя граница обязательна: без неё событие, записанное в будущем (рассинхрон часов
    // устройства, перенесённый вручную момент события в тестах) ошибочно попадало бы в
    // статистику текущей недели/месяца (ТЗ «Этап 2 — исправление», раздел 4.1).
    if (day >= weekFrom && day <= weekTo) movesThisWeek++;
    if (day >= monthFrom && day <= monthTo) movesThisMonth++;
  }
  let ambiguousMoves = 0;
  for (const e of state.events) {
    if (e.sourceId && (!ids || ids.has(e.sourceId)) && e.planningChange?.type === 'reschedule' && e.planningChange.ambiguousRepeat) ambiguousMoves++;
  }
  const tasksById = new Map(state.quests.map((q) => [q.id, q]));
  const top10: PostponedTask[] = [...byTask.entries()]
    .map(([id, v]) => ({ id, name: tasksById.get(id)?.name ?? 'Удалённая задача', sphere: tasksById.get(id)?.sphere ?? 'tasks', moves: v.moves }))
    // Стабильная сортировка при равенстве: по числу переносов, затем по id задачи.
    .sort((a, b) => b.moves - a.moves || a.id.localeCompare(b.id))
    .slice(0, 10);
  // Задачи с известной плановой датой: либо есть историческое событие планирования с 'to'
  // (включая 'schedule' на существующей задаче), либо у задачи ПРЯМО СЕЙЧАС есть dueAt/startsAt —
  // так учитываются задачи, созданные сразу с готовой датой (например, синхронизированные из
  // TickTick при первом импорте) и задачи старше появления журнала переноса, у которых нет
  // события 'schedule', но план всё равно известен (ТЗ «Этап 2 — исправление», раздел 4.2).
  const scheduledTaskIds = new Set(
    state.events.filter((e) => e.sourceId && (!ids || ids.has(e.sourceId)) && e.planningChange && e.planningChange.type !== 'time' && e.planningChange.to).map((e) => e.sourceId!),
  );
  for (const q of state.quests) {
    if (ids && !ids.has(q.id)) continue;
    if (q.dueAt || q.startsAt) scheduledTaskIds.add(q.id);
  }
  const postponedForwardTaskIds = new Set([...byTask.entries()].filter(([, v]) => v.forward > 0).map(([id]) => id));
  const MIN_SCHEDULED_FOR_RATE = 5;
  const insufficientData = scheduledTaskIds.size < MIN_SCHEDULED_FOR_RATE;
  return {
    totalMoves: events.length,
    tasksWithMoves: byTask.size,
    movesThisWeek, movesThisMonth, forwardMoves, backwardMoves, ambiguousMoves,
    averagePerTask: byTask.size ? events.length / byTask.size : 0,
    mostPostponed: top10[0],
    top10,
    postponementRate: insufficientData || !scheduledTaskIds.size ? undefined : postponedForwardTaskIds.size / scheduledTaskIds.size,
    insufficientData,
  };
}
export type TimeAnalytics = {
  /** Сумма плановых минут по всем задачам (включая незавершённые — текущий план, не итог). */
  plannedMinutes: number;
  /** Сумма учтённых фактических минут по всем задачам (включая незавершённые). */
  actualMinutes: number;
  /** Среднее отклонение факт−план (минуты; положительное — дольше плана) — только по ЗАВЕРШЁННЫМ задачам с обоими значениями, см. комментарий к timeAnalytics(). */
  averageDeviationMinutes?: number;
  /** Точность оценки (Plan Accuracy): среднее по завершённым задачам с обоими значениями от 1 − |факт−план|/план, клампится в [0;1]. 1 — оценка точна, 0 — отклонение ≥ 100% плана и больше. Отражает именно точность оценки длительности, а не долю выполненных задач. */
  planAccuracy?: number;
  /** Число завершённых задач с известными планом и фактом, вошедших в расчёт отклонения/точности. */
  tasksWithBoth: number;
};
/**
 * `questIds` — ограничить подсчёт конкретным набором задач (сфера/проект/неделя/месяц); по умолчанию — все задачи с историей.
 *
 * Отклонение факт−план и точность оценки (`planAccuracy`) считаются только по ЗАВЕРШЁННЫМ
 * задачам (`task.done`): у незавершённой задачи учтённое время — это ещё не окончательный
 * результат, а промежуточная сессия работы (например, через таймер), и сравнивать её с полной
 * плановой длительностью как с итогом было бы искажением (ТЗ «Этап 2 — исправление», раздел 5.2).
 * `plannedMinutes`/`actualMinutes` в сумме включают все задачи (в том числе незавершённые) —
 * это просто текущие итоги «запланировано»/«учтено», а не утверждение о финальном результате.
 * Задача без зафиксированного факта (0 минут) по-прежнему считается «неизвестной» и не входит
 * в расчёт точности — `actual` остаётся falsy (раздел 5.3), в расчёт не подставляется ноль.
 */
export function timeAnalytics(state: GameState, questIds?: Iterable<string>): TimeAnalytics {
  const ids = questIds ? new Set(questIds) : undefined;
  let plannedMinutes = 0, actualMinutesTotal = 0, deviationSum = 0, accuracySum = 0, tasksWithBoth = 0;
  for (const task of state.quests) {
    if (ids && !ids.has(task.id)) continue;
    const actual = actualMinutes(state, task.id);
    if (task.estimateMinutes) plannedMinutes += task.estimateMinutes;
    actualMinutesTotal += actual;
    if (task.estimateMinutes && actual && task.done) {
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
/**
 * Переносы, обнаруженные в течение календарного месяца 'YYYY-MM' — по дате события, а не по
 * дате задачи (ТЗ 6.2, карточки отчёта месяца). `e.date.startsWith(month)` сравнивает ISO-дату
 * события как строку в UTC: `planningDay()`/локальный календарный день здесь не нужен, так как
 * сравнивается с границами того же `month`, а не с сегодняшним локальным днём (в отличие от
 * `postponementAnalytics`, где локальный день пользователя важен для «текущей» недели/месяца).
 */
export function monthlyMoves(state: GameState, month: string): { moves: number; forward: number; ambiguous: number } {
  let moves = 0, forward = 0, ambiguous = 0;
  for (const e of state.events) {
    if (e.planningChange?.type !== 'reschedule' || !e.date.startsWith(month)) continue;
    if (e.planningChange.ambiguousRepeat) { ambiguous++; continue; }
    moves++;
    if (e.planningChange.direction === 'forward') forward++;
  }
  return { moves, forward, ambiguous };
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
/**
 * Грубый разбор интервала повторения из RRULE `repeatFlag` TickTick (например
 * `RRULE:FREQ=DAILY;INTERVAL=30`). Возвращает ожидаемую разницу в днях между соседними
 * автоматическими повторениями — точную для DAILY/WEEKLY (без набора нескольких дней недели),
 * диапазон для MONTHLY/YEARLY (число дней в месяце/году не фиксировано). `undefined` — если
 * FREQ не распознана или неделя с несколькими BYDAY (там интервал между повторами непостоянен,
 * например «по будням» даёт то 1, то 3 дня) — тогда шаг повтора нельзя надёжно предсказать.
 */
function repeatStepDays(rrule: string | undefined): { min: number; max: number } | undefined {
  if (!rrule) return undefined;
  const freq = /FREQ=([A-Z]+)/.exec(rrule)?.[1];
  const interval = Math.max(1, Number(/INTERVAL=(\d+)/.exec(rrule)?.[1] ?? '1'));
  const byDay = /BYDAY=([^;]+)/.exec(rrule)?.[1];
  const byMonthDay = /BYMONTHDAY=([^;]+)/.exec(rrule)?.[1];
  if (freq === 'DAILY') return { min: interval, max: interval };
  if (freq === 'WEEKLY') return byDay?.includes(',') ? undefined : { min: interval * 7, max: interval * 7 };
  // MONTHLY с несколькими BYMONTHDAY (например, 1 и 15 числа) — следующее наступление может быть
  // через несколько дней ИЛИ через почти весь месяц в зависимости от того, какая дата сработала;
  // диапазон 28–31 день тут неверен и слишком узок, поэтому — как и для нескольких BYDAY —
  // консервативно «неопределённо», а не ошибочно точный шаг.
  if (freq === 'MONTHLY') return byMonthDay?.includes(',') ? undefined : { min: interval * 28, max: interval * 31 };
  if (freq === 'YEARLY') return { min: interval * 365, max: interval * 366 };
  return undefined;
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
  const dayDelta = dayChanged && fromDay && toDay
    ? Math.round((Date.parse(`${toDay}T12:00:00Z`) - Date.parse(`${fromDay}T12:00:00Z`)) / 86400000) : undefined;
  const direction: 'forward' | 'backward' | undefined = dayDelta !== undefined ? (dayDelta > 0 ? 'forward' : 'backward') : undefined;
  // Open API v1 TickTick не различает «следующий повтор» и ручной перенос одной и той же
  // связанной задачи: обе операции одинаково меняют dueDate того же id, и в самом API нет
  // отдельного поля «причина изменения» (ТЗ «Этап 2 — исправление», раздел 2, пункты 1–3).
  // Единственный доступный факт — ожидаемый шаг повтора из RRULE. Автоматическое наступление
  // следующего повтора ВСЕГДА сдвигает дату вперёд на этот шаг — никогда не назад и никогда на
  // другую длительность. Поэтому:
  //   - перенос назад — никогда не 'ambiguousRepeat' (автоповтор не умеет сдвигать дату назад);
  //   - перенос вперёд НЕ совпадающий с шагом повтора — тоже не 'ambiguousRepeat': такой сдвиг
  //     не может быть автоматическим наступлением следующего повтора по определению, значит это
  //     достоверный перенос пользователя (пример из ТЗ: ежедневная задача, перенесённая с 10 на
  //     12 ноября — сдвиг на 2 дня не совпадает с шагом «раз в день», и засчитывается как перенос);
  //   - перенос вперёд, совпадающий с шагом повтора (или если шаг повтора не удалось разобрать) —
  //     причину нельзя доказать ни в одну сторону, помечается 'ambiguousRepeat'.
  // Событие сохраняется в истории в любом случае, с явной меткой неопределённости там, где она
  // есть (ограничение документировано в docs/planning-system-2.0/STAGE2_IMPLEMENTATION.md).
  const step = type === 'reschedule' ? repeatStepDays(task.tickTickRepeatFlag) : undefined;
  const ambiguousRepeat: true | undefined = type === 'reschedule' && task.tickTickRepeatFlag && direction === 'forward'
    && (!step || (dayDelta !== undefined && dayDelta >= step.min && dayDelta <= step.max)) ? true : undefined;
  const change: PlanningChange = {
    type,
    ...(from ? { from } : {}), ...(to ? { to } : {}),
    ...(reason?.trim() ? { reason: reason.trim() } : {}),
    ...(reasonCode ? { reasonCode } : {}),
    ...(direction ? { direction } : {}),
    ...(ambiguousRepeat ? { ambiguousRepeat } : {}),
  };
  return addPlanningEvent(state, task, change, id);
}
