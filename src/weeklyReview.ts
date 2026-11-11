import type { GameState, Goal } from './game.ts';
import { addDays, mondayOf } from './tasksCalendar.ts';
import { planningDay, planningMetrics, validDay } from './planningData.ts';
import { visiblePlanningTask, taskDay } from './planner.ts';
import { goalHistory, nextGoalTask } from './goalWorkspace.ts';
import { isGoalDone } from './goalsOverview.ts';

// ---------------------------------------------------------------------------
// «Мастер недельного обзора» (ТЗ «Этап 3», раздел 5). Только компактная сводка
// по уже существующим данным (planningData.ts, goalWorkspace.ts, planner.ts) —
// ничего не выдумывается и не переносится автоматически (ТЗ, раздел 5.1, шаг 4:
// выбор фокуса не меняет расписание TickTick).
// ---------------------------------------------------------------------------

export const MAX_WEEKLY_FOCUS = 3;
export const MAX_WEEKLY_REVIEW_NOTE = 500;
export const MAX_WEEKLY_REVIEW_PROBLEM_TASKS = 10;

/** Понедельник недели, которую нужно подводить — по умолчанию текущая. */
export function weekAnchor(now = new Date()): string {
  return mondayOf(planningDay(now.toISOString()) ?? planningDay(new Date().toISOString())!);
}

// --- Шаг 1: итоги недели -----------------------------------------------
export type WeeklyReviewTotals = {
  weekStart: string;
  weekEnd: string;
  /** Задачи, завершённые в пределах недели (по дате фактического завершения). */
  done: number;
  /** Задачи, запланированные на неделю и не завершённые на момент подсчёта. */
  undone: number;
  /** Из них — с плановой датой, уже прошедшей на момент подсчёта (подмножество undone). */
  overdue: number;
  /** Достоверные переносы (без недоказанных повторов TickTick), записанные в течение недели. */
  moves: number;
  /** Учтённое фактическое время за неделю (минуты, из записей таймера/ручного учёта с датой внутри недели). */
  actualMinutes: number;
};
export function weeklyReviewTotals(state: GameState, weekFrom: string, now = new Date()): WeeklyReviewTotals {
  const weekTo = addDays(weekFrom, 6);
  const today = planningDay(now.toISOString())!;
  const inWeek = (d?: string) => !!d && d >= weekFrom && d <= weekTo;
  let done = 0, undone = 0, overdue = 0;
  for (const q of state.quests) {
    if (!visiblePlanningTask(q)) continue;
    if (q.done) {
      if (inWeek(q.completedAt ? planningDay(q.completedAt) : undefined)) done++;
      continue;
    }
    const plannedDay = taskDay(q);
    if (inWeek(plannedDay)) {
      undone++;
      if (plannedDay! < today) overdue++;
    }
  }
  let moves = 0, actualMinutes = 0;
  for (const e of state.events) {
    if (!e.sourceId || !e.planningChange) continue;
    const day = planningDay(e.date);
    if (!inWeek(day)) continue;
    if (e.planningChange.type === 'reschedule' && !e.planningChange.ambiguousRepeat) moves++;
    if (e.planningChange.type === 'time') actualMinutes += e.planningChange.minutes;
  }
  return { weekStart: weekFrom, weekEnd: weekTo, done, undone, overdue, moves, actualMinutes };
}

// --- Шаг 2: проблемные задачи --------------------------------------------
export type WeeklyReviewProblemTask = { id: string; name: string; moves: number; overdue: boolean };
/** Чаще всего переносимые и просроченные незавершённые задачи — «предложить открыть для пересмотра» (ТЗ 3, раздел 5.1, шаг 2). */
export function weeklyReviewProblemTasks(state: GameState, now = new Date(), limit = MAX_WEEKLY_REVIEW_PROBLEM_TASKS): WeeklyReviewProblemTask[] {
  const today = planningDay(now.toISOString())!;
  const metrics = planningMetrics(state);
  const items: WeeklyReviewProblemTask[] = [];
  for (const q of state.quests) {
    if (!visiblePlanningTask(q) || q.done) continue;
    const moves = metrics.get(q.id)?.moves ?? 0;
    const d = taskDay(q);
    const overdue = !!d && d < today;
    if (moves > 0 || overdue) items.push({ id: q.id, name: q.name, moves, overdue });
  }
  return items
    .sort((a, b) => b.moves - a.moves || Number(b.overdue) - Number(a.overdue))
    .slice(0, limit);
}

// --- Шаг 3: продвижение проектов ----------------------------------------
export type WeeklyReviewProjectStatus = 'advanced' | 'needsAttention' | 'noActivity';
export const weeklyReviewProjectStatusLabels: Record<WeeklyReviewProjectStatus, string> = {
  advanced: 'Продвинулся на этой неделе',
  needsAttention: 'Есть следующий шаг, но без активности на неделе',
  noActivity: 'Нет подтверждённой активности и следующего шага',
};
export type WeeklyReviewProjectEntry = {
  goalId: string;
  name: string;
  status: WeeklyReviewProjectStatus;
  /** Этапы проекта, завершённые в пределах недели. */
  stagesCompletedThisWeek: number;
};
/**
 * Только активные (не на паузе, не завершённые) проекты. Самостоятельная упрощённая версия —
 * не зависит от более подробного «Контроля проектов» модуля 3.2 (ещё не влит в main на момент
 * написания), чтобы этот модуль собирался и проверялся независимо.
 */
export function weeklyReviewProjects(state: GameState, weekFrom: string, now = new Date()): WeeklyReviewProjectEntry[] {
  const weekTo = addDays(weekFrom, 6);
  const inWeek = (d?: string) => !!d && d >= weekFrom && d <= weekTo;
  return state.goals
    .filter((g) => !isGoalDone(g) && !g.paused)
    .map((g) => {
      const history = goalHistory(state, g);
      const advancedThisWeek = history.some((e) => inWeek(planningDay(e.date)));
      const stagesCompletedThisWeek = (g.stages ?? []).filter((s) => inWeek(s.completedAt ? planningDay(s.completedAt) : undefined)).length;
      const status: WeeklyReviewProjectStatus = advancedThisWeek
        ? 'advanced'
        : nextGoalTask(state, g, now)
          ? 'needsAttention'
          : 'noActivity';
      return { goalId: g.id, name: g.name, status, stagesCompletedThisWeek };
    });
}

// --- Шаги 4-5: фокус и сохранённый обзор ---------------------------------
export type WeeklyReview = {
  weekStart: string;
  confirmedAt: string;
  totals: WeeklyReviewTotals;
  projects: WeeklyReviewProjectEntry[];
  /** ID самых проблемных задач на момент подведения итогов (снимок, не живая ссылка). */
  problemTaskIds: string[];
  /** До трёх приоритетных проектов на следующую неделю (ТЗ 5.1, шаг 4). */
  focusGoalIds: string[];
  /** Свободный текст — направление, не привязанное к конкретному проекту. */
  focusNote?: string;
};
export function validWeeklyReview(v: unknown): v is WeeklyReview {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  const totals = r.totals as Record<string, unknown> | undefined;
  return (
    validDay(r.weekStart) &&
    typeof r.confirmedAt === 'string' && Number.isFinite(Date.parse(r.confirmedAt)) &&
    typeof totals === 'object' && totals !== null &&
    validDay(totals.weekStart) && validDay(totals.weekEnd) &&
    ['done', 'undone', 'overdue', 'moves', 'actualMinutes'].every((k) => typeof totals[k] === 'number' && Number.isFinite(totals[k])) &&
    Array.isArray(r.projects) &&
    r.projects.every((p) => typeof p === 'object' && p !== null &&
      typeof (p as Record<string, unknown>).goalId === 'string' &&
      typeof (p as Record<string, unknown>).name === 'string' &&
      ['advanced', 'needsAttention', 'noActivity'].includes((p as Record<string, unknown>).status as string) &&
      typeof (p as Record<string, unknown>).stagesCompletedThisWeek === 'number') &&
    Array.isArray(r.problemTaskIds) && r.problemTaskIds.length <= MAX_WEEKLY_REVIEW_PROBLEM_TASKS &&
    r.problemTaskIds.every((id) => typeof id === 'string') &&
    Array.isArray(r.focusGoalIds) && r.focusGoalIds.length <= MAX_WEEKLY_FOCUS &&
    r.focusGoalIds.every((id) => typeof id === 'string') &&
    new Set(r.focusGoalIds as string[]).size === (r.focusGoalIds as string[]).length &&
    (r.focusNote === undefined || (typeof r.focusNote === 'string' && r.focusNote.length <= MAX_WEEKLY_REVIEW_NOTE))
  );
}
/** Сохранённые обзоры, новые сначала — для «открыть предыдущие обзоры» (ТЗ 5.1, шаг 5). */
export function weeklyReviews(state: GameState): WeeklyReview[] {
  return Object.values(state.weeklyReviews ?? {}).sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
}
export function weeklyReviewOf(state: GameState, weekFrom: string): WeeklyReview | undefined {
  return state.weeklyReviews?.[weekFrom];
}
/**
 * Пересчитывает итоги/проекты на момент подтверждения и сохраняет обзор. Выбор фокуса не
 * трогает TickTick и расписание задач (ТЗ 5.1, шаг 4) — это только заметка самому себе внутри
 * PLAY YOUR LIFE.
 */
export function confirmWeeklyReview(
  state: GameState,
  weekFrom: string,
  focusGoalIds: string[],
  options: { focusNote?: string; problemTaskIds?: string[] } = {},
  now = new Date(),
): GameState {
  if (!validDay(weekFrom) || mondayOf(weekFrom) !== weekFrom) throw new Error('Неделя обзора должна начинаться с понедельника.');
  if (focusGoalIds.length > MAX_WEEKLY_FOCUS) throw new Error(`Можно выбрать не больше ${MAX_WEEKLY_FOCUS} приоритетных проектов.`);
  if (new Set(focusGoalIds).size !== focusGoalIds.length) throw new Error('Проект выбран дважды.');
  for (const id of focusGoalIds) if (!state.goals.some((g: Goal) => g.id === id)) throw new Error('Проект для фокуса не найден.');
  const focusNote = options.focusNote?.trim();
  if (focusNote && focusNote.length > MAX_WEEKLY_REVIEW_NOTE) throw new Error('Слишком длинная заметка фокуса.');
  const problemTaskIds = (options.problemTaskIds ?? []).slice(0, MAX_WEEKLY_REVIEW_PROBLEM_TASKS);
  const review: WeeklyReview = {
    weekStart: weekFrom,
    confirmedAt: now.toISOString(),
    totals: weeklyReviewTotals(state, weekFrom, now),
    projects: weeklyReviewProjects(state, weekFrom, now),
    problemTaskIds,
    focusGoalIds: [...focusGoalIds],
    ...(focusNote ? { focusNote } : {}),
  };
  if (!validWeeklyReview(review)) throw new Error('Проверь данные недельного обзора.');
  return { ...state, weeklyReviews: { ...state.weeklyReviews, [weekFrom]: review } };
}
