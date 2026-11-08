import type { GameState, Quest } from './game.ts';
import { planningDay, validDay } from './planningData.ts';
import { addDays } from './tasksCalendar.ts';
import { stageMetrics } from './goalWorkspace.ts';

export function dayDistance(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
}
export function timelineDays(start: string, end: string): string[] {
  if (!validDay(start) || !validDay(end)) throw new Error('Выбери корректный период шкалы.');
  const length = dayDistance(start, end) + 1;
  if (length < 1 || length > 93) throw new Error('Шкала показывает от 1 до 93 дней.');
  return Array.from({ length }, (_, i) => addDays(start, i));
}
export function timelinePlacement(start: string, end: string, from?: string, to?: string) {
  const a = planningDay(from ?? to), b = planningDay(to ?? from);
  if (!a || !b) return undefined;
  if (a > b) return { invalid: true as const, offset: 0, span: 0 };
  if (b < start || a > end) return { outside: true as const, offset: 0, span: 0 };
  const left = a < start ? start : a, right = b > end ? end : b;
  return { offset: dayDistance(start, left), span: dayDistance(left, right) + 1 };
}
export type TimelineRow = {
  id: string; kind: 'task' | 'stage'; title: string; from?: string; to?: string;
  progress: number; task?: Quest; projectName?: string;
  projectId?: string; stageId?: string;
};
export function timelineRows(state: GameState, tasks: Quest[]): TimelineRow[] {
  const rows: TimelineRow[] = [];
  const stages = new Set<string>();
  for (const q of tasks) {
    const g = state.goals.find((g) => g.id === q.goalId);
    const stage = g?.stages?.find((s) => s.id === q.stageId);
    if (g && stage && !stages.has(`${g.id}:${stage.id}`)) {
      stages.add(`${g.id}:${stage.id}`);
      rows.push({ id: `stage:${g.id}:${stage.id}`, kind: 'stage', title: stage.name,
        from: stage.startsAt ?? g.startsAt, to: stage.dueAt ?? g.dueAt,
        progress: stageMetrics(state, g, stage).progress, projectName: g.name, projectId: g.id, stageId: stage.id });
    }
    rows.push({ id: `task:${q.id}`, kind: 'task', title: q.name, task: q, from: q.startsAt ?? q.dueAt, to: q.dueAt ?? q.startsAt,
      progress: q.done ? 100 : Math.min(100, Math.round((q.currentValue ?? 0) / (q.targetValue ?? 1) * 100)), projectName: g?.name });
  }
  return rows;
}
