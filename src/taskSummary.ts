import type { Quest } from './game.ts';
import { addDays, calendarDay, calendarItem, mondayOf } from './tasksCalendar.ts';

/** Выполнения за выбранную неделю в часовом поясе устройства, включая обе границы. */
export function completedInWeek(quests: Quest[], today: string): Quest[] {
  const start = mondayOf(today);
  const end = addDays(start, 6);
  return quests.filter((q) => {
    const day = calendarDay(q.completedAt);
    return q.done && !q.wontDo && !q.planning?.archivedAt && !!day && day >= start && day <= end;
  });
}

/** Группы дневного списка; отсутствие даты сохраняет прежнее поведение «Сегодня». */
export function todayTaskGroups(quests: Quest[], today: string) {
  const day = (q: Quest) => calendarItem(q)?.day;
  const active = quests.filter((q) => !q.done && !q.wontDo && !q.planning?.archivedAt);
  const pinnedFirst = (a: Quest, b: Quest) => Number(!!b.pinned) - Number(!!a.pinned);
  return {
    overdue: active.filter((q) => !!day(q) && day(q)! < today)
      .sort((a, b) => pinnedFirst(a, b) || day(a)!.localeCompare(day(b)!)),
    today: active.filter((q) => !day(q) || day(q) === today).sort(pinnedFirst),
    done: quests.filter((q) => q.done && !q.wontDo && !q.planning?.archivedAt && calendarDay(q.completedAt) === today),
  };
}
