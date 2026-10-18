import { useState } from 'react';
import { spheres } from '../game';
import type { GameState, Quest } from '../game';
import { taskContribution } from '../taskSettings';
import './GoalTaskList.css';

const filters = [['all', 'Все'], ['game', 'Игра'], ['ticktick', 'TickTick']] as const;
const short = (day?: string) => (day ? new Date(`${day.slice(0, 10)}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : 'без срока');

export default function GoalTaskList({ state, quests, today, onOpen, onProgress }: { state: GameState; quests: Quest[]; today: string; onOpen: (id: string) => void; onProgress: (q: Quest) => void }) {
  const [filter, setFilter] = useState<(typeof filters)[number][0]>('all');
  const [showDone, setShowDone] = useState(false);
  const shown = quests.filter((q) => (showDone || !q.done)
    && (filter === 'all' || (filter === 'ticktick' ? !!q.tickTickSharedAt : !q.tickTickSharedAt)));
  const inGoal = (q: Quest) => !!q.goalId && state.goals.some((g) => g.id === q.goalId);
  const goals = state.goals.filter((g) => shown.some((q) => q.goalId === g.id));
  const loose = shown.filter((q) => !inGoal(q));
  const row = (q: Quest) => {
    const c = taskContribution(state, q);
    const late = !q.done && (q.dueAt ?? '9').slice(0, 10) < today;
    return (
      <li key={q.id} className={q.done ? 'gtl-item is-done' : 'gtl-item'}>
        <button type="button" className="gtl-row" onClick={() => onOpen(q.id)}>
          <span className="gtl-name">{q.tickTickSharedAt ? '⟳ ' : ''}{q.name}</span>
          <span className={late ? 'gtl-due is-late' : 'gtl-due'}>{short(q.dueAt)}</span>
          <span className="gtl-xp">+{c.xp} XP</span>
        </button>
        {q.done ? <span className="gtl-ok" aria-label="Выполнено">✓</span> : (
          <button type="button" className="gtl-go" onClick={() => onProgress(q)}>Продолжить</button>
        )}
      </li>
    );
  };
  return (
    <section className="gtl" aria-label="Задачи по целям и этапам">
      <div className="gtl-head">
        <h2>Задачи по целям</h2>
        <div className="gtl-tools">
          <label className="gtl-done"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Выполненные</label>
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
                <ul>{list.map(row)}</ul>
              </div>
            ))}
          </article>
        );
      })}
      {loose.length > 0 && (
        <article className="gtl-goal">
          <h3>Без цели</h3>
          <div className="gtl-stage"><ul>{loose.map(row)}</ul></div>
        </article>
      )}
    </section>
  );
}
