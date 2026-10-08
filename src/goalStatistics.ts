import type { GameState, Goal } from './game.ts';
import { goalHistory } from './goalWorkspace.ts';
export type GoalChartRow = {
  date: string;
  planned: number;
  actual: number;
  xp: number;
};
export type ProgressPoint = { date: string; value: number };
const dayKey = (value: string) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** Actual event dates and task deadlines only; no reconstructed historical progress. */
export function goalStatistics(state: GameState, goal: Goal, stageId?: string) {
  const tasks = state.quests.filter(
    (q) => q.goalId === goal.id && (!stageId || q.stageId === stageId),
  );
  const history = goalHistory(state, goal, stageId);
  const earned = history.filter((e) => e.xp > 0);
  const dates = [
    ...new Set(
      [
        ...tasks.flatMap((q) =>
          [q.dueAt, q.completedAt].filter((d): d is string => !!d),
        ),
        ...earned.map((e) => e.date),
      ].map(dayKey),
    ),
  ]
    .sort()
    .slice(-30);
  const rows: GoalChartRow[] = dates.map((date) => ({
    date,
    planned: tasks.filter((q) => q.dueAt && dayKey(q.dueAt) <= date).length,
    actual: tasks.filter(
      (q) => q.done && q.completedAt && dayKey(q.completedAt) <= date,
    ).length,
    xp: earned
      .filter((e) => dayKey(e.date) <= date)
      .reduce((sum, e) => sum + e.xp, 0),
  }));
  const progress: ProgressPoint[] = history
    .slice()
    .reverse()
    .flatMap((e) => {
      const value = stageId ? e.stageProgress : e.goalProgress;
      return value === undefined ? [] : [{ date: e.date, value }];
    })
    .slice(-100);
  return {
    rows,
    progress,
    totalXP: earned.reduce((sum, e) => sum + e.xp, 0),
    planned: tasks.filter((q) => q.dueAt).length,
    done: tasks.filter((q) => q.done).length,
    undatedDone: tasks.filter((q) => q.done && !q.completedAt).length,
  };
}
/** Keep unequal date intervals unequal, and make one-point series visible. */
export function chartCoordinates(
  points: ProgressPoint[],
  maximum: number,
  extent = points.map((p) => p.date),
) {
  const timestamps = extent.map((d) =>
    Date.parse(d.length === 10 ? `${d}T12:00:00` : d),
  );
  const start = Math.min(...timestamps),
    end = Math.max(...timestamps);
  return points.map((p) => {
    const time = Date.parse(
      p.date.length === 10 ? `${p.date}T12:00:00` : p.date,
    );
    return {
      ...p,
      x: end > start ? 24 + ((time - start) / (end - start)) * 552 : 300,
      y:
        154 -
        (Math.max(0, Math.min(maximum, p.value)) / Math.max(1, maximum)) * 130,
    };
  });
}
