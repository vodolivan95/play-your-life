import { useState } from 'react';
import type { GameState, Quest } from '../game';
import { taskDay } from '../planner';
import { planningDay } from '../planningData';
import { addDays } from '../tasksCalendar';
import { moveWeekTask, weekMoveIsLate, weekReviewTasks } from '../weekPlan';

const label = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });

type Apply = (update: (state: GameState) => GameState, message?: string) => void;

function PendingTask({ task, nextWeek, move, open }: {
  task: Quest; nextWeek: string[]; move: (id: string, day: string | null, late: boolean) => void; open: () => void;
}) {
  const [destination, setDestination] = useState('');
  const day = taskDay(task);
  const due = planningDay(task.deadlineAt);
  const late = Boolean(destination && destination !== 'unscheduled' && weekMoveIsLate(task, destination));
  return <li>
    <button type="button" onClick={open}>{task.name}</button>
    <small>{day ? label(day) : 'Без даты'}{due && ' · Срок ' + label(due)}</small>
    <form className="wrw-move" onSubmit={event => {
      event.preventDefault();
      if (!destination) return;
      if (late && !window.confirm('Новый день после дедлайна. Перенести задачу?')) return;
      move(task.id, destination === 'unscheduled' ? null : destination, late);
    }}>
      <select aria-label={'Новый день для «' + task.name + '»'} required value={destination} onChange={event => setDestination(event.target.value)}>
        <option value="">Выбрать новый день</option>
        {nextWeek.map(date => <option key={date} value={date}>{label(date)}</option>)}
        <option value="unscheduled">Без даты</option>
      </select>
      <button type="submit" aria-label={'Перенести «' + task.name + '»'} disabled={!destination}>Перенести</button>
      {late && <small className="wrw-late" role="status">Новый день после дедлайна.</small>}
    </form>
  </li>;
}

export default function WeekReviewTaskLists({ state, week, ownerId, apply, onOpen, readOnly, compact }: {
  state: GameState; week: string; ownerId: string; apply: Apply; onOpen: (id: string) => void; readOnly: boolean; compact: boolean;
}) {
  const { done, pending, moved } = weekReviewTasks(state, week, ownerId);
  const nextWeek = Array.from({ length: 7 }, (_, index) => addDays(week, index + 7));
  return <>
    {compact && <div className="wrw-grid wrw-summary" aria-label="Сводка недели">
      <span><b>{done.length}</b>Выполнено</span>
      <span><b>{pending.length}</b>Осталось</span>
      <span><b>{moved.length}</b>Перенесено</span>
    </div>}
    <div className="wrw-task-columns">
      <section aria-label="Незавершённые задачи">
        <h3>Незавершённые задачи</h3>
        {pending.length ? <ul className="wrw-list">{pending.map(task => readOnly
          ? <li key={task.id}><button type="button" onClick={() => onOpen(task.id)}>{task.name}</button></li>
          : <PendingTask key={task.id} task={task} nextWeek={nextWeek} move={(id, day, late) => {
            apply(current => moveWeekTask(current, id, day, ownerId, late, week),
              day ? 'Задача перенесена на ' + label(day) : 'Задача возвращена в «Без даты»');
          }} open={() => onOpen(task.id)} />)}</ul> : <p>Оставшихся задач нет.</p>}
      </section>
      <section aria-label="Выполненные задачи">
        <h3>Выполненные задачи</h3>
        {done.length ? <ul className="wrw-list">{done.map(task => <li key={task.id}><button type="button" onClick={() => onOpen(task.id)}>✓ {task.name}</button></li>)}</ul>
          : <p>На этой неделе пока ничего не выполнено.</p>}
      </section>
    </div>
    {moved.length > 0 && <section aria-label="Перенесённые задачи">
      <h3>Перенесённые задачи</h3>
      <ul className="wrw-list">{moved.map(task => <li key={task.id}>{task.name}<small>{task.day ? label(task.day) : 'Без даты'}</small></li>)}</ul>
    </section>}
  </>;
}
