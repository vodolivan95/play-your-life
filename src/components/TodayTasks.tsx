import { useState } from 'react';
import type { GameState, Quest } from '../game';
import { calendarItem } from '../tasksCalendar';
import { todayTaskGroups } from '../taskSummary';
import { taskContribution } from '../taskSettings';
import TaskLabelBadge from './TaskLabelBadge';
import './GoalTaskList.css';

const short = (day?: string) =>
  day
    ? new Date(`${day.slice(0, 10)}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    : 'без срока';

/**
 * Вкладка «Задачи на сегодня» страницы «Мои задачи»: то же определение «пора
 * сегодня», что и на главной (`questsForToday()` в `src/game.ts`) — срок
 * (`dueAt ?? startsAt`) сегодня или в прошлом, либо задача вовсе без срока;
 * плюс то, что уже выполнено сегодня. Группировка — «Просрочено» / «Сегодня»
 * / «Выполнено сегодня», как в сводке над вкладками (`TasksSummary.tsx`).
 */
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
  const day = (q: Quest) => calendarItem(q)?.day;
  const { overdue, today: dueToday, done } = todayTaskGroups(quests, today);
  const nothing = !overdue.length && !dueToday.length && (!showDone || !done.length);

  const row = (q: Quest) => {
    const c = taskContribution(state, q);
    const late = !q.done && (day(q) ?? '9') < today;
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
          <span className={late ? 'gtl-due is-late' : 'gtl-due'}>{short(day(q))}</span>
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
      {nothing && (
        <p className="gtl-empty">На сегодня задач нет. Добавь новую задачу или загляни во «Входящие».</p>
      )}
      {overdue.length > 0 && (
        <article className="gtl-goal">
          <h3>Просрочено</h3>
          <div className="gtl-stage">
            <ul>{overdue.map(row)}</ul>
          </div>
        </article>
      )}
      {dueToday.length > 0 && (
        <article className="gtl-goal">
          <h3>Сегодня</h3>
          <div className="gtl-stage">
            <ul>{dueToday.map(row)}</ul>
          </div>
        </article>
      )}
      {showDone && done.length > 0 && (
        <article className="gtl-goal">
          <h3>Выполнено сегодня</h3>
          <div className="gtl-stage">
            <ul>{done.map(row)}</ul>
          </div>
        </article>
      )}
    </section>
  );
}
