import { useState } from 'react';
import type { GameState, Quest } from '../game';
import { calendarItems, itemsForDay } from '../tasksCalendar';
import { taskContribution } from '../taskSettings';
import TaskLabelBadge from './TaskLabelBadge';
import './GoalTaskList.css';

const short = (day: string) =>
  new Date(`${day.slice(0, 10)}T12:00:00`).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });

/** Вкладка «Задачи на сегодня» повторяет задачи календаря ровно за выбранный день. */
export default function TodayTasks({
  state,
  quests,
  today,
  onOpen,
  onProgress,
}: {
  state: GameState;
  quests: Quest[];
  today: string;
  onOpen: (id: string) => void;
  onProgress: (q: Quest) => void;
}) {
  const [showDone, setShowDone] = useState(true);
  const scheduledToday = itemsForDay(calendarItems(quests), today).map((item) => item.quest);
  const tasks = scheduledToday.filter((q) => showDone || !q.done);

  const row = (q: Quest) => {
    const c = taskContribution(state, q);
    return (
      <li key={q.id} className={q.done ? 'gtl-item is-done' : 'gtl-item'}>
        <button type="button" className="gtl-row" onClick={() => onOpen(q.id)}>
          <span className="gtl-name">
            <span>
              {q.pinned ? '📌 ' : ''}
              {q.tickTickSharedAt ? '⟳ ' : ''}
              {q.name}
            </span>
            <TaskLabelBadge labelId={q.labelId} labels={state.taskLabels} />
          </span>
          <span className="gtl-due">{short(today)}</span>
          <span className="gtl-xp">+{c.xp} XP</span>
        </button>
        {q.done ? (
          <span className="gtl-ok" aria-label="Выполнено">
            ✓
          </span>
        ) : (
          <button type="button" className="gtl-go" onClick={() => onProgress(q)}>
            Продолжить
          </button>
        )}
      </li>
    );
  };

  return (
    <section className="gtl" aria-label="Задачи на сегодня">
      <div className="gtl-head">
        <h2>Задачи на сегодня</h2>
        <label className="gtl-done">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Выполненные
        </label>
      </div>
      {tasks.length ? (
        <div className="gtl-stage">
          <ul>{tasks.map(row)}</ul>
        </div>
      ) : (
        <p className="gtl-empty">На сегодня задач нет. Добавь новую задачу или загляни во «Входящие».</p>
      )}
    </section>
  );
}
