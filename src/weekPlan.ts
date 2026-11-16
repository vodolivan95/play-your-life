import type { GameState, Quest } from './game.ts';
import { availableMinutes, moveTaskToDay, taskDay, visiblePlanningTask } from './planner.ts';
import { planningDay, validDay } from './planningData.ts';
import { addDays, mondayOf } from './tasksCalendar.ts';
import { taskFinishesAfterDeadline } from './taskEditor.ts';
import { shiftDate } from './taskSettings.ts';

export const WEEK_OUTCOME_COUNT = 3;
export const WEEK_OUTCOME_TITLE_LIMIT = 80;
export const SLEEP_HOURS = 8;
export const WAKING_MINUTES = (24 - SLEEP_HOURS) * 60;
const REVIEW_REASON = 'Итоги недели';

export type WeekOutcome = { title: string; taskIds: string[] };
export type WeekPlanOutcomes = Record<string, (WeekOutcome | null)[]>;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const validWeek = (week: unknown): week is string => validDay(week) && mondayOf(week) === week;
const owns = (q: Quest, ownerId: string) => !q.ownerId || q.ownerId === ownerId;
const validTitle = (title: unknown): title is string =>
  typeof title === 'string' && title.trim().length > 0 && title.length <= WEEK_OUTCOME_TITLE_LIMIT;

export function validWeekPlanOutcomes(value: unknown): value is WeekPlanOutcomes {
  return record(value) && Object.entries(value).every(([week, slots]) => {
    if (!validWeek(week) || !Array.isArray(slots) || slots.length !== WEEK_OUTCOME_COUNT) return false;
    const seen = new Set<string>();
    return slots.every(slot => {
      if (slot === null) return true;
      if (!record(slot) || !validTitle(slot.title) || !Array.isArray(slot.taskIds)) return false;
      return slot.taskIds.every(id => {
        if (typeof id !== 'string' || !id || id.length > 300 || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    });
  });
}

export function weekOutcomes(state: GameState, week: string): (WeekOutcome | null)[] {
  return state.weekPlanOutcomes?.[week] ?? Array<null>(WEEK_OUTCOME_COUNT).fill(null);
}

export function saveWeekOutcome(state: GameState, week: string, slot: number, title: string): GameState {
  title = title.trim();
  if (!validWeek(week) || !Number.isInteger(slot) || slot < 0 || slot >= WEEK_OUTCOME_COUNT || !validTitle(title))
    throw new Error('Укажи название результата недели.');
  const slots = weekOutcomes(state, week).map((outcome, index) =>
    index === slot ? { title, taskIds: outcome?.taskIds ?? [] } : outcome);
  return { ...state, weekPlanOutcomes: { ...state.weekPlanOutcomes, [week]: slots } };
}

export function linkWeekTask(state: GameState, week: string, taskId: string, slot: number | null, ownerId: string): GameState {
  const slots = weekOutcomes(state, week);
  const task = state.quests.find(q => q.id === taskId);
  if (!validWeek(week) || !task || !owns(task, ownerId) || !visiblePlanningTask(task) || (slot !== null && !slots[slot]))
    throw new Error('Задача или результат недели недоступны.');
  const current = slots.findIndex(outcome => outcome?.taskIds.includes(taskId));
  if (current === (slot ?? -1)) return state;
  const next = slots.map((outcome, index) => {
    if (!outcome) return null;
    if (index === slot) return { ...outcome, taskIds: [...outcome.taskIds, taskId] };
    if (index === current) return { ...outcome, taskIds: outcome.taskIds.filter(id => id !== taskId) };
    return outcome;
  });
  return { ...state, weekPlanOutcomes: { ...state.weekPlanOutcomes, [week]: next } };
}

export function weekPlanDays(state: GameState, week: string, ownerId: string) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(week, index);
    return { day, tasks: [] as Quest[], planned: 0, budget: availableMinutes(state, day) };
  });
  const byDate = new Map(days.map(day => [day.day, day]));
  const backlog: Quest[] = [];
  for (const q of state.quests) {
    if (!owns(q, ownerId) || !visiblePlanningTask(q)) continue;
    const date = taskDay(q);
    if (!date && !q.done) backlog.push(q);
    const day = date ? byDate.get(date) : undefined;
    if (day) {
      day.tasks.push(q);
      day.planned += q.estimateMinutes ?? 0;
    }
  }
  return { days, backlog };
}

/** The same shifted timestamps as the existing planner, including a timed deadline on the same day. */
export function weekMoveIsLate(q: Quest, destination: string): boolean {
  if (!q.deadlineAt) return false;
  const current = taskDay(q);
  if (!current) return taskFinishesAfterDeadline({ dueAt: destination, deadlineAt: q.deadlineAt });
  const offset = Math.round((Date.parse(destination + 'T12:00:00Z') - Date.parse(current + 'T12:00:00Z')) / 86400000);
  const shifted = (value?: string) => value && offset ? shiftDate(value, offset) : value;
  return taskFinishesAfterDeadline({ startsAt: shifted(q.startsAt), dueAt: shifted(q.dueAt), deadlineAt: q.deadlineAt });
}

export function moveWeekTask(state: GameState, id: string, day: string | null, ownerId: string, allowLate: boolean, reviewWeek?: string): GameState {
  const task = state.quests.find(q => q.id === id);
  if (!task || !owns(task, ownerId) || task.done || !visiblePlanningTask(task)) throw new Error('Задача недоступна для переноса.');
  if (day !== null && !validDay(day)) throw new Error('Выбери дату.');
  if (reviewWeek && (!validWeek(reviewWeek) || !inWeek(taskDay(task), reviewWeek) || (day && !inWeek(day, addDays(reviewWeek, 7)))))
    throw new Error('План изменился. Выбери дату на следующей неделе или «Без даты».');
  if (day && weekMoveIsLate(task, day) && !allowLate) throw new Error('День выполнения позже дедлайна. Подтверди перенос.');
  return moveTaskToDay(state, id, day, ownerId, reviewWeek && REVIEW_REASON, undefined, undefined, { allowPastDeadline: allowLate });
}

const inWeek = (day: string | undefined, week: string) => !!day && day >= week && day <= addDays(week, 6);

export function weekReviewTasks(state: GameState, week: string, ownerId: string) {
  const tasks = state.quests.filter(q => owns(q, ownerId) && visiblePlanningTask(q));
  const done = tasks.filter(q => q.done && inWeek(planningDay(q.completedAt), week));
  const pending = tasks.filter(q => !q.done && inWeek(taskDay(q), week));
  const byId = new Map(tasks.map(task => [task.id, task]));
  const moved = new Map<string, { id: string; name: string; day?: string }>();
  for (const event of state.events) {
    const change = event.planningChange;
    if (!event.sourceId || !change || (change.type !== 'schedule' && change.type !== 'reschedule') ||
      change.reason !== REVIEW_REASON || !inWeek(planningDay(change.from), week) || moved.has(event.sourceId)) continue;
    const task = byId.get(event.sourceId);
    if (task && !inWeek(taskDay(task), week))
      moved.set(task.id, { id: task.id, name: task.name, day: planningDay(change.to) });
  }
  return { done, pending, moved: [...moved.values()] };
}
