import { useContext } from 'react';
import type { Quest } from '../game';
import { TickTickContext } from '../tickTickContext';
import { addDays, mondayOf } from '../tasksCalendar';
import { incomingForToday } from '../ticktickInbox';
import './TasksSummary.css';

export default function TasksSummary({ quests, today }: { quests: Quest[]; today: string }) {
  const manager = useContext(TickTickContext);
  const open = quests.filter((q) => !q.done);
  const day = (q: Quest) => (q.dueAt ?? q.startsAt)?.slice(0, 10);
  const weekEnd = addDays(mondayOf(today), 6);
  const weekStart = mondayOf(today);
  const tiles: [string, number, string][] = [
    ['Сегодня', open.filter((q) => day(q) === today).length + incomingForToday(manager?.incoming ?? []).length, 'не выполнено'],
    ['Просрочено', open.filter((q) => (day(q) ?? '9') < today).length, 'требуют внимания'],
    ['На неделе', open.filter((q) => (day(q) ?? '') >= today && (day(q) ?? '') <= weekEnd).length, 'до воскресенья'],
    ['Из TickTick', quests.filter((q) => q.tickTickSharedAt || manager?.connection?.links[q.id]).length, 'в синхронизации'],
    ['Входящие', manager?.incoming.length ?? 0, 'ждут выбора'],
    ['Выполнено', quests.filter((q) => q.done && q.completedAt && q.completedAt.slice(0, 10) >= weekStart).length, 'за неделю'],
  ];
  return (
    <section className="tsum" aria-label="Сводка по задачам">
      {tiles.map(([label, value, hint]) => (
        <div key={label}><small>{label}</small><b>{value}</b><span>{hint}</span></div>
      ))}
    </section>
  );
}
