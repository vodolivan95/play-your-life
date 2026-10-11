import { dateKey, questsForToday, spheres } from './game.ts';
import type { Event, GameState, Quest } from './game.ts';
import { sphereMetrics } from './sphereAnalytics.ts';
import { sphereProgress } from './sphereProgress.ts';

/** Положение сферы относительно среднего уровня активных сфер. */
export type SphereStatus = 'strong' | 'normal' | 'weak';
export const statusLabels: Record<SphereStatus, string> = { strong: 'Сильная', normal: 'В пути', weak: 'Внимание' };

/** Звание района по уровню сферы (0–100). */
export function sphereRank(level: number) {
  if (level >= 100) return 'Легенда района';
  if (level >= 50) return 'Эксперт';
  if (level >= 25) return 'Мастер';
  if (level >= 10) return 'Практик';
  if (level >= 3) return 'Ученик';
  return 'Новичок';
}

export function sphereStatus(level: number, average: number, anyActive: boolean): SphereStatus {
  if (!anyActive) return 'normal';
  if (level >= average + 1) return 'strong';
  if (level <= average - 1) return 'weak';
  return 'normal';
}

const DAY = 86400000;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
/** Понедельник недели, в которую входит дата. */
function weekStart(date: Date) {
  const day = startOfDay(date);
  return new Date(day.getTime() - ((day.getDay() + 6) % 7) * DAY);
}

function sphereEvents(state: GameState, id: string) {
  return state.events.filter((e) => e.sphere === id && e.xp > 0);
}

/** Сколько дней подряд (до сегодня или вчера включительно) в сфере были действия с XP. */
export function sphereStreak(events: Event[], now = new Date()) {
  const days = new Set(events.map((e) => dateKey(new Date(e.date))));
  let cursor = startOfDay(now);
  if (!days.has(dateKey(cursor))) cursor = new Date(cursor.getTime() - DAY);
  let count = 0;
  while (days.has(dateKey(cursor))) {
    count += 1;
    cursor = new Date(cursor.getTime() - DAY);
  }
  return count;
}

/** XP сферы по неделям: последние `weeks` недель, последняя — текущая. */
export function weeklyXP(events: Event[], now = new Date(), weeks = 8) {
  const current = weekStart(now).getTime();
  const result = Array.from({ length: weeks }, (_, i) => ({ start: new Date(current - (weeks - 1 - i) * 7 * DAY), xp: 0 }));
  for (const event of events) {
    const index = weeks - 1 - Math.round((current - weekStart(new Date(event.date)).getTime()) / (7 * DAY));
    if (index >= 0 && index < weeks) result[index].xp += event.xp;
  }
  return result;
}

export type SphereCardData = ReturnType<typeof sphereCards>[number];

/** Всё, что показывает карточка района на странице «Сферы жизни». */
export function sphereCards(state: GameState, now = new Date()) {
  const metrics = sphereMetrics(state);
  const today = questsForToday(state, now);
  const weekAgo = now.getTime() - 7 * DAY;
  return metrics.rows.map((row) => {
    const events = sphereEvents(state, row.id);
    const last = events.reduce<number | null>((max, e) => Math.max(max ?? 0, new Date(e.date).getTime()), null);
    const projects = state.goals.filter((g) => g.sphere === row.id && g.current < g.target).length;
    const todayTasks = today.filter((q) => q.sphere === row.id);
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      level: row.level,
      maxed: row.maxed,
      currentXP: row.currentXP,
      requiredXP: row.requiredXP,
      progress: row.progress,
      totalXP: state.spheres[row.id]?.xp ?? 0,
      rank: sphereRank(row.level),
      status: sphereStatus(row.level, metrics.average, metrics.activeCount > 0),
      projects,
      tasksToday: todayTasks.filter((q) => !q.done).length,
      streak: sphereStreak(events, now),
      idleDays: last === null ? null : Math.floor((startOfDay(now).getTime() - startOfDay(new Date(last)).getTime()) / DAY),
      weekXP: events.filter((e) => new Date(e.date).getTime() >= weekAgo).reduce((sum, e) => sum + e.xp, 0),
      average: metrics.average,
    };
  });
}

export type SphereSort = 'order' | 'weak' | 'strong';
export type SphereCardFilter = 'all' | 'tasks' | 'weak' | 'strong';
export function arrangeCards(cards: SphereCardData[], filter: SphereCardFilter, sort: SphereSort) {
  const list = cards.filter((c) => filter === 'all' || (filter === 'tasks' ? c.tasksToday > 0 : c.status === filter));
  if (sort === 'order') return list;
  return [...list].sort((a, b) => (sort === 'weak' ? a.totalXP - b.totalXP : b.totalXP - a.totalXP));
}

/** Ближайшие открытые задачи на сегодня по всем сферам. */
export function nextSteps(state: GameState, limit = 4, now = new Date()): { quest: Quest; project: string | null }[] {
  return questsForToday(state, now)
    .filter((q) => !q.done)
    .slice(0, limit)
    .map((quest) => ({ quest, project: state.goals.find((g) => g.id === quest.goalId)?.name ?? null }));
}

/** Подробности открытой сферы: задачи дня, XP по неделям, история. */
export function sphereDetail(state: GameState, id: string, now = new Date()) {
  const events = sphereEvents(state, id);
  const info = spheres.find((s) => s.id === id)!;
  const progress = sphereProgress(state.spheres[id]?.xp ?? 0);
  return {
    info,
    progress,
    rank: sphereRank(progress.level),
    streak: sphereStreak(events, now),
    weeks: weeklyXP(events, now),
    tasksToday: questsForToday(state, now).filter((q) => q.sphere === id),
    projects: state.goals.filter((g) => g.sphere === id && g.current < g.target),
    history: [...state.events.filter((e) => e.sphere === id)].sort((a, b) => b.date.localeCompare(a.date)),
  };
}
