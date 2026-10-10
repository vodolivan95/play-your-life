import type { Goal, GameState } from './game.ts';

export const MAX_MONTHLY_FOCUS = 3;

export type MonthlyFocus = { month: string; goalIds: string[] };

export function monthKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    timeZone: 'Europe/Moscow',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}`;
}

export function validMonthlyFocus(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.month !== 'string' || !/^\d{4}-\d{2}$/.test(v.month)) return false;
  if (!Array.isArray(v.goalIds) || v.goalIds.length > MAX_MONTHLY_FOCUS) return false;
  if (!v.goalIds.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 120)) return false;
  return new Set(v.goalIds).size === v.goalIds.length;
}

/** Выбранные на текущий месяц цели. Выбор прошлого месяца не переносится. */
export function monthlyFocusGoals(state: GameState, now: Date = new Date()): Goal[] {
  const focus = state.monthlyFocus;
  if (!focus || focus.month !== monthKey(now)) return [];
  return focus.goalIds
    .map((id) => state.goals.find((g) => g.id === id))
    .filter((g): g is Goal => Boolean(g));
}

/** Добавляет или убирает цель из главных квестов месяца (не больше трёх). */
export function toggleMonthlyFocus(state: GameState, goalId: string, now: Date = new Date()): GameState {
  if (!state.goals.some((g) => g.id === goalId)) throw new Error('Такой цели нет.');
  const month = monthKey(now);
  const current = state.monthlyFocus?.month === month ? state.monthlyFocus.goalIds : [];
  if (current.includes(goalId)) {
    return { ...state, monthlyFocus: { month, goalIds: current.filter((id) => id !== goalId) } };
  }
  if (current.length >= MAX_MONTHLY_FOCUS) throw new Error('Можно выбрать не больше трёх главных квестов месяца.');
  return { ...state, monthlyFocus: { month, goalIds: [...current, goalId] } };
}
