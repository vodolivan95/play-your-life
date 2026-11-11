import type { GameState, Goal, GoalStage, Quest } from './game.ts';
import {
  activeGoalStage,
  goalProgressValue,
  nextGoalTask,
  stageMetrics,
} from './goalWorkspace.ts';
import { monthlyFocusGoals } from './monthlyFocus.ts';

export type TimeProgress = {
  percent: number;
  elapsedDays: number;
  remainingDays: number;
  totalDays: number;
  state: 'before' | 'active' | 'due-today' | 'overdue' | 'invalid';
};

/** Treat date-only values as local calendar days; timestamp values use their local calendar date. */
function calendarDate(value: string): Date | null {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayDifference(later: Date, earlier: Date) {
  return Math.round((later.getTime() - earlier.getTime()) / 86400000);
}

export function calculateTimeProgress(startsAt: string | undefined, dueAt: string | undefined, now = new Date()): TimeProgress | null {
  if (!startsAt || !dueAt) return null;
  const start = calendarDate(startsAt);
  const end = calendarDate(dueAt);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!start || !end || end < start) return { percent: 0, elapsedDays: 0, remainingDays: 0, totalDays: 0, state: 'invalid' };
  const totalDays = dayDifference(end, start);
  const elapsedDays = Math.max(0, dayDifference(today, start));
  const remainingDays = dayDifference(end, today);
  if (totalDays === 0) {
    return { percent: today < start ? 0 : 100, elapsedDays, remainingDays, totalDays, state: today < start ? 'before' : today.getTime() === start.getTime() ? 'due-today' : 'overdue' };
  }
  const percent = Math.max(0, Math.min(100, (elapsedDays / totalDays) * 100));
  const state = today < start ? 'before' : remainingDays < 0 ? 'overdue' : remainingDays === 0 ? 'due-today' : 'active';
  return { percent, elapsedDays: Math.min(totalDays, elapsedDays), remainingDays, totalDays, state };
}

export type NextPeak = {
  goalId: string;
  goalName: string;
  goalImage?: string;
  stageId?: string;
  stageName?: string;
  startsAt?: string;
  dueAt?: string;
  stageStatus: 'active' | 'completed' | 'none' | 'unavailable';
  headline: string;
  detail: string;
  done: number;
  total: number;
  /** Percentage based on the existing weighted stage metrics. */
  percent: number;
  /** Banner percentage based on completed / total tasks. Null means no countable tasks. */
  taskPercent: number | null;
  /** Approximate task-progress minus elapsed-time percentage points; informational only. */
  progressDifference: number | null;
  counter: string;
  taskId?: string;
  time: TimeProgress | null;
};

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
function remainingText(required: Quest[]) {
  const left = required.filter((q) => !q.done).length;
  return left > 0 ? `осталось ${left} ${plural(left, 'задача', 'задачи', 'задач')}` : '';
}
function nextTask(state: GameState, goal: Goal, stage?: GoalStage) {
  const next = nextGoalTask(state, goal);
  return next?.stageId === stage?.id ? next : stage
    ? state.quests.find((q) => q.goalId === goal.id && q.stageId === stage.id && !q.done && !q.rewardClaimed && !q.wontDo && !q.planning?.archivedAt)
    : next;
}

export function goalPeak(state: GameState, goal: Goal, now: Date = new Date()): NextPeak {
  const stages = goal.stages ?? [];
  const activeStage = activeGoalStage(state, goal, now);
  const completed = stages.length > 0 && stages.every((s) => stageMetrics(state, goal, s).complete);
  if (activeStage) {
    const m = stageMetrics(state, goal, activeStage);
    const taskProgressExact = m.total > 0 ? (m.done / m.total) * 100 : null;
    const taskPercent = taskProgressExact === null ? null : Math.round(taskProgressExact);
    const time = calculateTimeProgress(activeStage.startsAt, activeStage.dueAt, now);
    const left = remainingText(m.required);
    return {
      goalId: goal.id, goalName: goal.name, goalImage: goal.image,
      stageId: activeStage.id, stageName: activeStage.name, stageStatus: 'active',
      startsAt: activeStage.startsAt, dueAt: activeStage.dueAt,
      headline: activeStage.completionCondition?.trim() || activeStage.name,
      detail: [`Проект: ${goal.name}`, left].filter(Boolean).join(' · '),
      done: m.done, total: m.total, percent: Math.round(m.progress),
      taskPercent,
      progressDifference: taskProgressExact === null || !time || time.state === 'invalid' ? null : taskProgressExact - time.percent,
      counter: m.total > 0 ? `${m.done}/${m.total}` : '—',
      taskId: nextTask(state, goal, activeStage)?.id, time,
    };
  }
  if (completed) return {
    goalId: goal.id, goalName: goal.name, goalImage: goal.image,
    stageStatus: 'completed', headline: 'Все этапы проекта завершены', detail: `Проект: ${goal.name}`,
    done: 0, total: 0, percent: 100, taskPercent: null, progressDifference: null, counter: `${stages.length} этапов`, time: null,
  };
  if (stages.length > 0) return {
    goalId: goal.id, goalName: goal.name, goalImage: goal.image,
    stageStatus: 'unavailable', headline: 'Нет доступного активного этапа', detail: `Открой проект «${goal.name}»`,
    done: 0, total: 0, percent: 0, taskPercent: null, progressDifference: null, counter: '—', time: null,
  };
  const tasks = state.quests.filter((q) => q.goalId === goal.id && !q.wontDo && !q.planning?.archivedAt);
  const done = tasks.filter((q) => q.done).length;
  const percent = Math.round(goalProgressValue(state, goal));
  return {
    goalId: goal.id, goalName: goal.name, goalImage: goal.image, stageStatus: 'none',
    headline: 'Этапы пока не добавлены', detail: `Проект: ${goal.name}`,
    done, total: tasks.length, percent, taskPercent: tasks.length ? Math.round(done / tasks.length * 100) : null, progressDifference: null,
    counter: tasks.length ? `${done}/${tasks.length}` : `${percent}%`, taskId: nextTask(state, goal)?.id, time: null,
  };
}

/** «Следующая вершина» — только выбранные проекты месяца и в сохранённом пользовательском порядке. */
export function nextPeak(state: GameState, now = new Date()): NextPeak | null {
  const focus = new Set(monthlyFocusGoals(state, now).map((g) => g.id));
  const open = state.goals.filter((g) => !g.rewarded);
  if (!open.length) return null;
  return open
    .map((goal) => ({ goal, peak: goalPeak(state, goal, now) }))
    .sort((a, b) => Number(focus.has(b.goal.id)) - Number(focus.has(a.goal.id)) || b.peak.percent - a.peak.percent || (a.goal.dueAt ? Date.parse(a.goal.dueAt) : Infinity) - (b.goal.dueAt ? Date.parse(b.goal.dueAt) : Infinity) || a.goal.created.localeCompare(b.goal.created))[0].peak;
}
