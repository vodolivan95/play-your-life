import { habitDay } from './personalQuests.ts';
import type { Habit, HabitCompletion } from './personalQuests.ts';

/** Расчёты экрана «Привычки»: серии, статистика, календарь. Только чтение сохранения, награды не трогаются. */

export type DayStatus = 'done' | 'missed' | 'open' | 'future' | 'off';

const DAY = 86400000;

export function addDays(day: string, delta: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + delta * DAY).toISOString().slice(0, 10);
}
/** Номер дня недели 0–6 (0 — воскресенье) для ключа YYYY-MM-DD. */
export function weekdayOf(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}
/** 0 — понедельник … 6 — воскресенье. */
export function mondayIndex(day: string): number {
  return (weekdayOf(day) + 6) % 7;
}
/** Последние n дней, заканчивая днём `today` (старые слева). */
export function lastDays(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
}

export function doneDays(h: Habit, history: HabitCompletion[]): Set<string> {
  return new Set(history.filter((c) => c.habitId === h.id && c.rewardClaimed).map((c) => c.day));
}
function createdDay(h: Habit): string {
  return habitDay(h, new Date(h.createdAt));
}
/** Запланирован ли день: привычка активна, уже создана и день недели выбран. */
export function isScheduled(h: Habit, day: string): boolean {
  return h.isActive && day >= createdDay(h) && h.weekdays.includes(weekdayOf(day));
}

export function dayStatus(h: Habit, done: Set<string>, day: string, today: string): DayStatus {
  if (done.has(day)) return 'done';
  if (day > today) return 'future';
  if (!isScheduled(h, day)) return 'off';
  return day === today ? 'open' : 'missed';
}

/** Серия по расписанию: подряд выполненные запланированные дни; выходной серию не рвёт, сегодняшний ещё не засчитанный тоже. */
export function liveStreak(h: Habit, done: Set<string>, today: string): number {
  let cursor = today;
  if (!done.has(cursor)) cursor = addDays(cursor, -1);
  const start = createdDay(h);
  let count = 0;
  for (let i = 0; i < 3660 && cursor >= start; i++, cursor = addDays(cursor, -1)) {
    if (!h.weekdays.includes(weekdayOf(cursor))) continue;
    if (!done.has(cursor)) break;
    count++;
  }
  return count;
}

export type HabitStats = {
  scheduled: number;
  done: number;
  missed: number;
  percent: number;
  perWeek: number;
  /** Индекс дня недели (0 — понедельник) с лучшим процентом, -1 если данных нет. */
  bestWeekday: number;
  weekdayPercent: number[];
  weeks: { start: string; percent: number }[];
  xp: number;
};

/** Статистика за последние `days` дней (по умолчанию 90) и по неделям (последние 8). */
export function habitStats(h: Habit, history: HabitCompletion[], today: string, days = 90): HabitStats {
  const done = doneDays(h, history);
  const sched = [0, 0, 0, 0, 0, 0, 0];
  const ok = [0, 0, 0, 0, 0, 0, 0];
  let scheduled = 0;
  let completed = 0;
  for (const day of lastDays(today, days)) {
    if (!isScheduled(h, day) && !done.has(day)) continue;
    const i = mondayIndex(day);
    sched[i]++;
    scheduled++;
    if (done.has(day)) {
      ok[i]++;
      completed++;
    }
  }
  const weekdayPercent = sched.map((s, i) => (s ? Math.round((ok[i] / s) * 100) : 0));
  const max = Math.max(...weekdayPercent);
  const weeks: HabitStats['weeks'] = [];
  for (let w = 7; w >= 0; w--) {
    const start = addDays(today, -w * 7 - 6);
    let s = 0;
    let d = 0;
    for (let j = 0; j < 7; j++) {
      const day = addDays(start, j);
      if (!isScheduled(h, day) && !done.has(day)) continue;
      s++;
      if (done.has(day)) d++;
    }
    weeks.push({ start, percent: s ? Math.round((d / s) * 100) : 0 });
  }
  return {
    scheduled,
    done: completed,
    missed: Math.max(0, scheduled - completed),
    percent: scheduled ? Math.round((completed / scheduled) * 100) : 0,
    perWeek: Math.round((completed / (days / 7)) * 10) / 10,
    bestWeekday: max > 0 ? weekdayPercent.indexOf(max) : -1,
    weekdayPercent,
    weeks,
    xp: completed * h.rewardXp,
  };
}

/** Процент выполнения запланированных дней за последние 7 дней по всем привычкам. */
export function weekPercent(habits: Habit[], history: HabitCompletion[], today: string): number {
  let s = 0;
  let d = 0;
  for (const h of habits) {
    const done = doneDays(h, history);
    for (const day of lastDays(today, 7)) {
      if (!isScheduled(h, day) && !done.has(day)) continue;
      s++;
      if (done.has(day)) d++;
    }
  }
  return s ? Math.round((d / s) * 100) : 0;
}

export type CalendarCell = { day: string; num: number; blank: boolean; future: boolean; isToday: boolean };

/** Сетка месяца (неделя с понедельника) для месяца дня `today`. */
export function monthCells(today: string): CalendarCell[] {
  const first = `${today.slice(0, 8)}01`;
  const lead = mondayIndex(first);
  const length = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7), 0)).getUTCDate();
  const cells: CalendarCell[] = Array.from({ length: lead }, () => ({ day: '', num: 0, blank: true, future: false, isToday: false }));
  for (let n = 1; n <= length; n++) {
    const day = `${today.slice(0, 8)}${String(n).padStart(2, '0')}`;
    cells.push({ day, num: n, blank: false, future: day > today, isToday: day === today });
  }
  return cells;
}
/** Сетка последних `weeks` недель, заканчивая неделей дня `today` (с понедельника). */
export function weekRows(today: string, weeks: number): CalendarCell[] {
  const lastMonday = addDays(today, -mondayIndex(today));
  const start = addDays(lastMonday, -(weeks - 1) * 7);
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const day = addDays(start, i);
    return { day, num: +day.slice(8), blank: false, future: day > today, isToday: day === today };
  });
}
