import type { GameState, Goal } from './game.ts';
import {
  activeGoalStage,
  goalProgressValue,
  nextGoalTask,
} from './goalWorkspace.ts';

export type GoalSort = 'due' | 'progress' | 'created';

const DAY = 86400000;

export const goalSortNames: Record<GoalSort, string> = {
  due: 'Сначала ближайший срок',
  progress: 'Сначала почти готовые',
  created: 'Сначала новые',
};

export const isGoalDone = (goal: Goal) => goal.current >= goal.target;

/** Whole days left until the deadline; negative when it has passed, undefined without one. */
export function goalDaysLeft(goal: Goal, now = new Date()) {
  if (!goal.dueAt) return undefined;
  const due = Date.parse(goal.dueAt);
  if (Number.isNaN(due)) return undefined;
  return Math.ceil((due - now.getTime()) / DAY);
}

export function pluralDays(count: number) {
  const n = Math.abs(count) % 100;
  const last = n % 10;
  if (n > 10 && n < 20) return `${count} дней`;
  if (last === 1) return `${count} день`;
  if (last >= 2 && last <= 4) return `${count} дня`;
  return `${count} дней`;
}

export function deadlineLabel(goal: Goal, now = new Date()) {
  if (isGoalDone(goal)) return 'Цель достигнута';
  const days = goalDaysLeft(goal, now);
  if (days === undefined) return 'Без срока';
  if (days < 0) return `Просрочено на ${pluralDays(-days)}`;
  if (days === 0) return 'Срок сегодня';
  return `Осталось ${pluralDays(days)}`;
}

export function goalsSummary(
  state: Pick<GameState, 'quests'>,
  goals: Goal[],
  now = new Date(),
) {
  const active = goals.filter((g) => !isGoalDone(g));
  const progress = active.map((g) => goalProgressValue(state, g));
  const upcoming = active
    .map((g) => goalDaysLeft(g, now))
    .filter((d): d is number => d !== undefined && d >= 0);
  return {
    active: active.length,
    averageProgress: progress.length
      ? Math.round(progress.reduce((a, b) => a + b, 0) / progress.length)
      : 0,
    nearestDays: upcoming.length ? Math.min(...upcoming) : undefined,
    pendingReward: active
      .filter((g) => !g.rewarded)
      .reduce((sum, g) => sum + g.reward, 0),
  };
}

/** The real next action: the nearest open task, else the stage the player is in. */
export function goalNextStep(state: GameState, goal: Goal, now = new Date()) {
  if (isGoalDone(goal)) return undefined;
  const task = nextGoalTask(state, goal, now);
  if (task) return { kind: 'task' as const, text: task.name };
  const stage = activeGoalStage(state, goal, now);
  if (stage) return { kind: 'stage' as const, text: stage.name };
  return undefined;
}

export function sortGoals(
  state: Pick<GameState, 'quests'>,
  goals: Goal[],
  mode: GoalSort,
  now = new Date(),
) {
  const copy = [...goals];
  const due = (g: Goal) => {
    const days = goalDaysLeft(g, now);
    return days === undefined ? Number.POSITIVE_INFINITY : days;
  };
  if (mode === 'progress')
    return copy.sort(
      (a, b) => goalProgressValue(state, b) - goalProgressValue(state, a),
    );
  if (mode === 'created')
    return copy.sort((a, b) => (Date.parse(b.created) || 0) - (Date.parse(a.created) || 0));
  return copy.sort((a, b) => due(a) - due(b));
}

/** Open tasks of the goal, nearest deadline first, undated ones last. */
export function goalUpcomingTasks(
  state: Pick<GameState, 'quests'>,
  goal: Goal,
  limit = 4,
) {
  const due = (q: { dueAt?: string }) => {
    const time = q.dueAt ? Date.parse(q.dueAt) : Number.NaN;
    return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
  };
  return state.quests
    .filter((q) => q.goalId === goal.id && !q.done)
    .sort((a, b) => (due(a) === due(b) ? 0 : due(a) < due(b) ? -1 : 1))
    .slice(0, limit);
}
