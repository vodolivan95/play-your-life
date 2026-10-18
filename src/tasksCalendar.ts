import { dateKey, difficulties } from './game.ts';
import type { Quest } from './game.ts';

/** Виды календаря задач: день, неделя, две недели, месяц. */
export type CalendarView = 'day' | 'week' | 'twoWeeks' | 'month';

export const calendarViews: { id: CalendarView; label: string }[] = [
  { id: 'day', label: 'День' },
  { id: 'week', label: 'Неделя' },
  { id: 'twoWeeks', label: '2 недели' },
  { id: 'month', label: 'Месяц' },
];

export type CalendarItem = {
  quest: Quest;
  day: string;
  /** Время начала «ЧЧ:ММ», если у задачи есть время. */
  start?: string;
  end?: string;
};

export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(key: string, days: number): string {
  const date = parseDay(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

export function mondayOf(key: string): string {
  const date = parseDay(key);
  return addDays(key, -((date.getDay() + 6) % 7));
}

/** Дни, которые показывает вид. Месяц — полные недели (5 или 6 строк). */
export function calendarDays(view: CalendarView, anchor: string): string[] {
  if (view === 'day') return [anchor];
  if (view === 'week') {
    const start = mondayOf(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }
  if (view === 'twoWeeks') {
    const start = mondayOf(anchor);
    return Array.from({ length: 14 }, (_, i) => addDays(start, i));
  }
  const first = anchor.slice(0, 8) + '01';
  const start = mondayOf(first);
  const date = parseDay(first);
  const monthDays = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const offset = (date.getDay() + 6) % 7;
  const weeks = Math.ceil((offset + monthDays) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
}

/** Сдвиг по стрелкам: день, неделя, две недели или месяц. */
export function shiftAnchor(view: CalendarView, anchor: string, direction: 1 | -1): string {
  if (view === 'month') {
    const date = parseDay(anchor.slice(0, 8) + '01');
    date.setMonth(date.getMonth() + direction);
    return dateKey(date);
  }
  const step = view === 'day' ? 1 : view === 'week' ? 7 : 14;
  return addDays(anchor, direction * step);
}

function hasTime(value?: string) {
  if (!value || !/T\d{2}:\d{2}/.test(value)) return false;
  return !/T00:00(:00)?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.test(value);
}

function dayOf(value: string) {
  return value.includes('T') ? dateKey(new Date(value)) : value.slice(0, 10);
}

function clock(value: string) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function minutesOf(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function plusMinutes(time: string, minutes: number) {
  const total = Math.min(23 * 60 + 59, minutesOf(time) + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Задача для календаря: день по сроку (или началу), время — только если оно есть. */
export function calendarItem(quest: Quest): CalendarItem | undefined {
  const base = quest.dueAt || quest.startsAt;
  if (!base) return undefined;
  const item: CalendarItem = { quest, day: dayOf(base) };
  const startsTimed = hasTime(quest.startsAt) && quest.startsAt;
  const dueTimed = hasTime(quest.dueAt) && quest.dueAt;
  if (startsTimed && dueTimed && dayOf(startsTimed) === dayOf(dueTimed)) {
    item.start = clock(startsTimed);
    item.end = clock(dueTimed);
  } else if (dueTimed) {
    item.start = clock(dueTimed);
    item.end = plusMinutes(item.start, 60);
  } else if (startsTimed) {
    item.start = clock(startsTimed);
    item.end = plusMinutes(item.start, 60);
  }
  if (item.start && item.end && minutesOf(item.end) <= minutesOf(item.start)) {
    item.end = plusMinutes(item.start, 60);
  }
  return item;
}

export function calendarItems(quests: Quest[]): CalendarItem[] {
  return quests.map(calendarItem).filter((item): item is CalendarItem => !!item);
}

export function itemsForDay(items: CalendarItem[], day: string): CalendarItem[] {
  return items
    .filter((item) => item.day === day)
    .sort((a, b) => {
      if (!!a.start !== !!b.start) return a.start ? 1 : -1;
      return (a.start ?? '').localeCompare(b.start ?? '') || a.quest.name.localeCompare(b.quest.name, 'ru');
    });
}

export function questReward(quest: Quest) {
  return quest.sourceType === 'USER_CREATED'
    ? difficulties[quest.difficulty as keyof typeof difficulties] ?? quest.xp
    : quest.xp;
}

/** Сводка дня: сколько задач, сколько выполнено и сколько XP. */
export function daySummary(items: CalendarItem[], day: string) {
  const own = items.filter((item) => item.day === day);
  const done = own.filter((item) => item.quest.done);
  const plan = own.reduce((sum, item) => sum + questReward(item.quest), 0);
  const earned = done.reduce((sum, item) => sum + questReward(item.quest), 0);
  return {
    count: own.length,
    done: done.length,
    plan,
    earned,
    percent: own.length ? Math.round((done.length / own.length) * 100) : 0,
  };
}

/** Ближайшая невыполненная задача: сегодня после текущего времени или в следующие дни. */
export function nextItem(items: CalendarItem[], now: Date): CalendarItem | undefined {
  const today = dateKey(now);
  const minutes = now.getHours() * 60 + now.getMinutes();
  return items
    .filter((item) => {
      if (item.quest.done) return false;
      if (item.day > today) return true;
      if (item.day < today) return false;
      return !item.start || minutesOf(item.start) > minutes;
    })
    .sort((a, b) => a.day.localeCompare(b.day) || (a.start ?? '99').localeCompare(b.start ?? '99'))[0];
}

/** Нагрузка недели: количество задач по дням с понедельника. */
export function weekLoad(items: CalendarItem[], anchor: string) {
  const start = mondayOf(anchor);
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, i);
    return { day, count: items.filter((item) => item.day === day).length };
  });
}

export function minutesUntil(item: CalendarItem, now: Date): number | undefined {
  if (item.day !== dateKey(now) || !item.start) return undefined;
  return minutesOf(item.start) - (now.getHours() * 60 + now.getMinutes());
}
