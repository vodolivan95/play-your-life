import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { spheres } from '../game';
import type { GameState, Quest } from '../game';
import { calendarItem } from '../tasksCalendar';
import { taskContribution } from '../taskSettings';
import { focusByTask, formatFocus } from '../focusCore';
import TaskLabelBadge from './TaskLabelBadge';
import TaskReorderList from './TaskReorderList';
import { reorderTaskList } from '../planning';
import './GoalTaskList.css';

const filters = [['all', 'Все'], ['game', 'Игра'], ['ticktick', 'TickTick']] as const;
const short = (day?: string) => (day ? new Date(`${day.slice(0, 10)}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : 'без срока');

export default function GoalTaskList({ state, quests, today, onOpen, onChange }: { state: GameState; quests: Quest[]; today: string; onOpen: (id: string) => void; onChange: Dispatch<SetStateAction<GameState>> }) {
  const [filter, setFilter] = useState<(typeof filters)[number][0]>('all');
  const [showDone, setShowDone] = useState(false);
  const [sort, setSort] = useState<'pinned' | 'manual'>('pinned');
  const filtered = quests
    .filter((q) => (showDone || (!q.done && !q.wontDo))
      && (filter === 'all' || (filter === 'ticktick' ? !!q.tickTickSharedAt : !q.tickTickSharedAt)));
  const shown = sort === 'pinned' ? filtered.slice().sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned)) : filtered;
  const inGoal = (q: Quest) => !!q.goalId && state.goals.some((g) => g.id === q.goalId);
  const goals = state.goals.filter((g) => shown.some((q) => q.goalId === g.id));
  const loose = shown.filter((q) => !inGoal(q));
  const focus = focusByTask(state);
  const row = (q: Quest) => {
    const c = taskContribution(state, q);
    const focused = focus.get(q.id) ?? 0;
    const late = !q.done && !q.wontDo && (calendarItem(q)?.day ?? '9') < today;
    return (
      <div className={q.wontDo ? 'gtl-item is-wontdo' : q.done ? 'gtl-item is-done' : 'gtl-item'}>
        <button type="button" className="gtl-row" onClick={() => onOpen(q.id)}>
          <span className="gtl-name"><span>{q.pinned ? '📌 ' : ''}{q.tickTickSharedAt ? '⟳ ' : ''}{q.name}</span><TaskLabelBadge labelId={q.labelId} labels={state.taskLabels} />{focused > 0 && <small className="gtl-focus">⏱ {formatFocus(focused)}</small>}</span>
          <span className={late ? 'gtl-due is-late' : 'gtl-due'}>{short(calendarItem(q)?.day)}</span>
          <span className="gtl-xp">+{c.xp} XP</span>
        </button>
        {q.wontDo ? <span className="gtl-wontdo" aria-label="Не делаем">⊘</span> : q.done ? <span className="gtl-ok" aria-label="Выполнено">✓</span> : null}
      </div>
    );
  };
  const ordered = (list: Quest[], label: string) => (
    <TaskReorderList
      tasks={list}
      label={label}
      onReorder={(sourceId, targetId, placement) => onChange((latest) => reorderTaskList(latest, list.map((task) => task.id), sourceId, targetId, placement))}
      renderTask={row}
      enabled={sort === 'manual'}
    />
  );
  return (
    <section className="gtl" aria-label="Задачи по проектам и этапам">
      <div className="gtl-head">
        <h2>Задачи по проектам</h2>
        <div className="gtl-tools">
          <label className="gtl-done"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Выполненные</label>
          <label className="gtl-done">Порядок
            <select aria-label="Сортировка списка задач" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="pinned">Закреплённые сверху</option><option value="manual">Вручную</option>
            </select>
          </label>
          <div className="gtl-filter" role="group" aria-label="Источник задач">
            {filters.map(([id, label]) => (
              <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
            ))}
          </div>
        </div>
      </div>
      {!goals.length && !loose.length && <p className="gtl-empty">Задач пока нет. Нажми «＋ Новая задача».</p>}
      {goals.map((goal) => {
        const sphere = spheres.find((s) => s.id === goal.sphere);
        const groups: [string, string, Quest[]][] = [
          ...(goal.stages ?? []).map((s): [string, string, Quest[]] => [s.id, s.name, shown.filter((q) => q.goalId === goal.id && q.stageId === s.id)]),
          ['', 'Без этапа', shown.filter((q) => q.goalId === goal.id && !(goal.stages ?? []).some((s) => s.id === q.stageId))],
        ];
        return (
          <article key={goal.id} className="gtl-goal">
            <h3>{sphere?.icon} {goal.name}</h3>
            {groups.filter(([, , list]) => list.length).map(([sid, name, list]) => (
              <div key={sid || 'none'} className="gtl-stage">
                <h4>{name} <small>{list.length}</small></h4>
              {ordered(list, `Задачи этапа ${name}`)}
              </div>
            ))}
          </article>
        );
      })}
      {loose.length > 0 && (
        <article className="gtl-goal">
          <h3>Без проекта</h3>
          <div className="gtl-stage">{ordered(loose, 'Задачи без проекта')}</div>
        </article>
      )}
    </section>
  );
}
