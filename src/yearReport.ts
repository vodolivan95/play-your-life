import { dateKey, spheres } from './game.ts';
import type { GameState } from './game.ts';
import { habitsReport } from './monthReport.ts';
import { monthKey, monthLabel, monthlySummary } from './monthly.ts';

/** Годовой отчёт читает только сохранённую историю; состояние игры не меняется. */

export type YearSphereRow = {
  id: string;
  name: string;
  color: string;
  tasks: number;
  share: number;
  months: number[];
  before: number | null;
  after: number | null;
};

export type YearHabitRow = {
  id: string;
  name: string;
  made: number;
  due: number;
  rate: number | null;
  months: { made: number; due: number }[];
};

export type YearHabitsReport = {
  rows: YearHabitRow[];
  totalMade: number;
  totalDue: number;
  rate: number | null;
};

const YEAR = /^[1-9]\d{3}$/;

export function validYear(value: string) {
  return YEAR.test(value);
}

export function yearKey(date = new Date()) {
  return String(date.getFullYear());
}

export function yearLabel(year: string) {
  if (!validYear(year)) throw new Error('Неверный год');
  return `${year} год`;
}

/** Двенадцать ключей месяцев выбранного года, от января до декабря. */
export function yearMonths(year: string) {
  if (!validYear(year)) throw new Error('Неверный год');
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`);
}

function daysInYear(year: string) {
  const number = Number(year);
  return Math.round((Date.UTC(number + 1, 0, 1) - Date.UTC(number, 0, 1)) / 86400000);
}

function passedDays(year: string, now: Date) {
  const currentYear = yearKey(now);
  const total = daysInYear(year);
  if (year < currentYear) return total;
  if (year > currentYear) return 0;
  const start = Date.UTC(Number(year), 0, 1);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.min(total, Math.floor((today - start) / 86400000) + 1));
}

function scoreAverage(rows: YearSphereRow[], field: 'before' | 'after') {
  return rows.reduce((total, row) => total + (row[field] as number), 0) / rows.length;
}

/**
 * Годы, для которых в локальной истории есть запись. Текущий год всегда доступен,
 * чтобы пустой новый год не подменялся lifetime-показателями.
 */
export function historyYears(state: GameState, now = new Date()) {
  const currentYear = yearKey(now);
  const today = dateKey(now);
  const years = new Set<string>([currentYear]);
  const add = (value: string | undefined, limit = true) => {
    if (!value) return;
    const year = value.slice(0, 4);
    if (validYear(year) && year <= currentYear && (!limit || value.slice(0, 10) <= today)) years.add(year);
  };

  for (const event of state.events) {
    const timestamp = new Date(event.date);
    if (!Number.isNaN(timestamp.getTime()) && timestamp <= now) add(dateKey(timestamp), false);
  }
  for (const day of state.activeDates) add(day);
  for (const completion of state.habitCompletions ?? []) add(completion.day);
  for (const month of Object.keys(state.monthlyReflections ?? {})) {
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month) && month <= monthKey(now)) add(month, false);
  }
  if (state.monthlyTracking) {
    const timestamp = new Date(state.monthlyTracking.since);
    if (!Number.isNaN(timestamp.getTime()) && timestamp <= now) add(dateKey(timestamp), false);
  }
  return [...years].sort((a, b) => b.localeCompare(a));
}

/**
 * Привычки за год: только запланированные дни до момента отчёта и подтверждённые
 * отметки. Используются те же правила дат и rewardClaimed, что в отчёте месяца.
 */
export function yearHabitsReport(state: GameState, year: string, now = new Date()): YearHabitsReport {
  const monthly = yearMonths(year).map((month) => habitsReport(state, month, now));
  const rows = (state.habits ?? []).filter((habit) => habit.isActive).map((habit) => {
    const months = monthly.map((report) => {
      const row = report.rows.find((item) => item.id === habit.id);
      return { made: row?.made ?? 0, due: row?.due ?? 0 };
    });
    const made = months.reduce((total, month) => total + month.made, 0);
    const due = months.reduce((total, month) => total + month.due, 0);
    return { id: habit.id, name: habit.title, made, due, rate: due ? Math.round((made / due) * 100) : null, months };
  });
  const totalMade = rows.reduce((total, row) => total + row.made, 0);
  const totalDue = rows.reduce((total, row) => total + row.due, 0);
  return { rows, totalMade, totalDue, rate: totalDue ? Math.round((totalMade / totalDue) * 100) : null };
}

/**
 * Итог выбранного года. Задачи считаются только по игровым событиям `kind: quest`:
 * ручные итоги не смешиваются с ними, а XP никогда не берётся из lifetime state.xp.
 */
export function yearReport(state: GameState, year: string, now = new Date()) {
  if (!validYear(year) || year > yearKey(now)) throw new Error('Неверный год');

  const keys = yearMonths(year);
  const summaries = keys.map((month) => monthlySummary(state, month, now));
  const events = summaries.flatMap((summary) => summary.events);
  const quests = events.filter((event) => event.kind === 'quest');
  const goals = events.filter((event) => event.kind === 'goal');
  const xp = summaries.reduce((total, summary) => total + summary.xp, 0);
  const today = dateKey(now);
  const activeDates = [...new Set(state.activeDates)]
    .filter((day) => /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(day) && day.slice(0, 4) === year && day <= today)
    .sort();
  const habits = yearHabitsReport(state, year, now);
  const start = summaries[0].sphereResults;
  const end = summaries[11].sphereResults;
  const sphereRows = spheres.map((sphere) => {
    const before = start.find((row) => row.id === sphere.id)?.before ?? null;
    const after = end.find((row) => row.id === sphere.id)?.after ?? null;
    const months = summaries.map((summary) => summary.events.filter((event) => event.kind === 'quest' && event.sphere === sphere.id).length);
    const tasks = months.reduce((total, count) => total + count, 0);
    return { id: sphere.id, name: sphere.name, color: sphere.color, tasks, share: 0, months, before, after };
  });
  const totalTasks = quests.length;
  for (const row of sphereRows) row.share = totalTasks ? Math.round((row.tasks / totalTasks) * 100) : 0;
  const scored = sphereRows.filter((row) => row.before !== null && row.after !== null);
  const balance = scored.length === spheres.length
    ? { before: scoreAverage(scored, 'before'), after: scoreAverage(scored, 'after') }
    : null;
  const daysTotal = daysInYear(year);
  const daysPassed = passedDays(year, now);
  const current = year === yearKey(now);

  return {
    year,
    label: yearLabel(year),
    current,
    availableYears: historyYears(state, now),
    months: summaries.map((summary) => ({
      key: summary.month,
      label: monthLabel(summary.month),
      xp: summary.xp,
      quests: summary.quests,
      goals: summary.goals,
      activeDays: summary.activeDays,
    })),
    xp,
    quests: totalTasks,
    goals: goals.length,
    activeDays: activeDates.length,
    activeDates,
    habits,
    daysTotal,
    daysPassed,
    daysLeft: daysTotal - daysPassed,
    daysProgress: Math.round((daysPassed / daysTotal) * 100),
    sphereRows,
    balance,
    scoresKnown: scored.length,
    partial: summaries.some((summary) => summary.partial),
    trackingSince: state.monthlyTracking?.since ?? null,
    hasRecordedData: xp > 0 || totalTasks > 0 || goals.length > 0 || activeDates.length > 0 || habits.totalDue > 0,
  };
}
