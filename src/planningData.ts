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
export type PlanningChange =
  | { type: 'schedule' | 'reschedule'; from?: string; to?: string; reason?: string }
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
  return ['schedule', 'reschedule'].includes(String(v.type))
    && Object.keys(v).every((k) => ['type', 'from', 'to', 'reason'].includes(k))
    && (v.from === undefined || instant(v.from)) && (v.to === undefined || instant(v.to))
    && (v.reason === undefined || (typeof v.reason === 'string' && v.reason.length <= 300))
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
export function moveCount(state: GameState, id: string): number {
  return taskPlanningEvents(state, id).filter((e) => e.planningChange?.type === 'reschedule').length;
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
    if (e.planningChange.type === 'reschedule') value.moves++;
    result.set(e.sourceId, value);
  }
  return result;
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
export function recordTaskSchedule(state: GameState, old: Quest | undefined, task: Quest, reason?: string, id?: string): GameState {
  const from = old?.dueAt ?? old?.startsAt;
  const to = task.dueAt ?? task.startsAt;
  if (!old || from === to) return state;
  const change: PlanningChange = {
    type: from && to && planningDay(from) !== planningDay(to) ? 'reschedule' : 'schedule',
    ...(from ? { from } : {}), ...(to ? { to } : {}), ...(reason?.trim() ? { reason: reason.trim() } : {}),
  };
  return addPlanningEvent(state, task, change, id);
}
