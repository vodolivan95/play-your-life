import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GameState, Quest } from '../game';
import { questsForCalendarDay } from '../tasksCalendar';
import { taskContribution } from '../taskSettings';
import TaskLabelBadge from './TaskLabelBadge';
import TaskReorderList from './TaskReorderList';
import { reorderTaskList } from '../planning';
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
  onChange,
}: {
  state: GameState;
  quests: Quest[];
  today: string;
  onOpen: (id: string) => void;
  onChange: Dispatch<SetStateAction<GameState>>;
}) {
  const [showDone, setShowDone] = useState(true);
  const [sort, setSort] = useState<'time' | 'order'>('time');
  const scheduledToday = questsForCalendarDay(quests, today);
  const scheduledIds = new Set(scheduledToday.map((task) => task.id));
  const manualOrder = quests.filter((task) => scheduledIds.has(task.id));
  const tasks = (sort === 'order' ? manualOrder : scheduledToday).filter((q) => showDone || !q.done);

  const row = (q: Quest) => {
    const c = taskContribution(state, q);
    return (
      <div className={q.done ? 'gtl-item is-done' : 'gtl-item'}>
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
        {q.done && (
          <span className="gtl-ok" aria-label="Выполнено">
            ✓
          </span>
        )}
      </div>
    );
  };

  return (
    <section className="gtl" aria-label="Задачи на сегодня">
      <div className="gtl-head">
        <h2>Задачи на сегодня</h2>
        <label className="gtl-done">Порядок
          <select aria-label="Сортировка задач на сегодня" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="time">По времени</option><option value="order">Вручную</option>
          </select>
        </label>
        <label className="gtl-done">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Выполненные
        </label>
      </div>
      {tasks.length ? (
        <div className="gtl-stage">
          <TaskReorderList
            tasks={tasks}
            label="Задачи на сегодня"
            enabled={sort === 'order'}
            onReorder={(sourceId, targetId, placement) => onChange((latest) => reorderTaskList(latest, tasks.map((task) => task.id), sourceId, targetId, placement))}
            renderTask={row}
          />
        </div>
      ) : (
        <p className="gtl-empty">На сегодня задач нет. Добавь новую задачу или загляни во «Входящие».</p>
      )}
    </section>
  );
}
