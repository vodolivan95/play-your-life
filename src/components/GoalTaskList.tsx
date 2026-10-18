import { useState } from 'react';
import { spheres } from '../game';
import type { GameState, Quest } from '../game';
import { taskContribution } from '../taskSettings';
import './GoalTaskList.css';

const filters = [['all', 'Все'], ['game', 'Игра'], ['ticktick', 'TickTick']] as const;
const short = (day?: string) => (day ? new Date(`${day.slice(0, 10)}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : 'без срока');

export default function GoalTaskList({ state, quests, today, onOpen }: { state: GameState; quests: Quest[]; today: string; onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState<(typeof filters)[number][0]>('all');
  const open = quests.filter((q) => !q.done && q.goalId && state.goals.some((g) => g.id === q.goalId)
    && (filter === 'all' || (filter === 'ticktick' ? !!q.tickTickSharedAt : !q.tickTickSharedAt)));
  const goals = state.goals.filter((g) => open.some((q) => q.goalId === g.id));
  return (
    <section className="gtl" aria-label="Задачи по целям и этапам">
      <div className="gtl-head">
        <h2>Задачи по целям и этапам</h2>
        <div className="gtl-filter" role="group" aria-label="Источник задач">
          {filters.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>
      </div>
      {!goals.length && <p className="gtl-empty">Задач внутри целей пока нет. Создай задачу и привяжи её к цели и этапу.</p>}
      {goals.map((goal) => {
        const sphere = spheres.find((s) => s.id === goal.sphere);
        const groups: [string, string, Quest[]][] = [
          ...(goal.stages ?? []).map((s): [string, string, Quest[]] => [s.id, s.name, open.filter((q) => q.goalId === goal.id && q.stageId === s.id)]),
          ['', 'Без этапа', open.filter((q) => q.goalId === goal.id && !(goal.stages ?? []).some((s) => s.id === q.stageId))],
        ];
        return (
          <article key={goal.id} className="gtl-goal">
            <h3>{sphere?.icon} {goal.name}</h3>
            {groups.filter(([, , list]) => list.length).map(([sid, name, list]) => (
              <div key={sid || 'none'} className="gtl-stage">
                <h4>{name} <small>{list.length}</small></h4>
                <ul>
                  {list.map((q) => {
                    const c = taskContribution(state, q);
                    const late = (q.dueAt ?? '9').slice(0, 10) < today;
                    return (
                      <li key={q.id}>
                        <button type="button" className="gtl-row" onClick={() => onOpen(q.id)}>
                          <span className="gtl-name">{q.tickTickSharedAt ? '⟳ ' : ''}{q.name}</span>
                          <span className={late ? 'gtl-due is-late' : 'gtl-due'}>{short(q.dueAt)}</span>
                          <span className="gtl-xp">+{c.xp} XP</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </article>
        );
      })}
    </section>
  );
}
