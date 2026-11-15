import { useEffect, useId, useRef, useState } from 'react';
import type { DragEvent, ReactNode } from 'react';
import type { GameState, Quest } from '../game';
import { taskDay } from '../planner';
import { planningDay } from '../planningData';
import { updateTaskSettings } from '../taskSettings';
import { taskFinishesAfterDeadline } from '../taskEditor';
import { addDays, mondayOf } from '../tasksCalendar';
import { linkWeekTask, moveWeekTask, saveWeekOutcome, SLEEP_HOURS, WAKING_MINUTES, WEEK_OUTCOME_TITLE_LIMIT, weekMoveIsLate, weekOutcomes, weekPlanDays } from '../weekPlan';
import './WeekPlanBoard.css';

type Apply = (update: (state: GameState) => GameState, message?: string) => void;
type Props = {
  state: GameState;
  ownerId: string;
  today: string;
  week: string;
  apply: Apply;
  changeWeek: (day: string) => void;
  openTask: (id: string) => void;
  newTask: (day?: string) => void;
  openReview: () => void;
  showList: () => void;
};

const date = (day: string) => new Date(day + 'T12:00:00');
const short = (day: string) => date(day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
const full = (day: string) => date(day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const weekday = (day: string) => date(day).toLocaleDateString('ru-RU', { weekday: 'short' });
const minutes = (value: number) => value < 60 ? value + ' мин' : Math.floor(value / 60) + ' ч' + (value % 60 ? ' ' + value % 60 + ' мин' : '');
const projectColors = ['#4c9def', '#43a58f', '#a595ec', '#d6a045', '#768caf'];

function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const label = useId();
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => { node?.close(); };
  }, []);
  return <dialog ref={dialog} className="week-plan-dialog" aria-labelledby={label}
    onCancel={e => { e.preventDefault(); close(); }}>
    <header><h3 id={label}>{title}</h3><button type="button" aria-label="Закрыть" onClick={close}>×</button></header>
    {children}
  </dialog>;
}

function WeekTaskEditor({ task, state, week, ownerId, apply, onOpen, close }: {
  task: Quest; state: GameState; week: string; ownerId: string; apply: Apply; onOpen: () => void; close: () => void;
}) {
  const outcomes = weekOutcomes(state, week);
  const previousSlot = outcomes.findIndex(outcome => outcome?.taskIds.includes(task.id));
  const originalDate = taskDay(task) ?? '';
  const originalDue = planningDay(task.deadlineAt) ?? '';
  const [day, setDay] = useState(originalDate);
  const [due, setDue] = useState(originalDue);
  const [slot, setSlot] = useState(previousSlot);
  const deadlineAt = due === originalDue ? task.deadlineAt : due || undefined;
  const preview = { ...task, deadlineAt };
  const late = !!day && weekMoveIsLate(preview, day);
  const datesEdited = day !== originalDate || due !== originalDue;
  return <Modal title={task.name} close={close}>
    <form onSubmit={event => {
      event.preventDefault();
      if (late && datesEdited && !window.confirm('День выполнения позже дедлайна. Сохранить план?')) return;
      apply(current => {
        const latest = current.quests.find(q => q.id === task.id && (!q.ownerId || q.ownerId === ownerId));
        if (!latest) throw new Error('Задача больше недоступна.');
        let next = current;
        if (datesEdited) {
          if (latest.done || latest.startsAt !== task.startsAt || latest.dueAt !== task.dueAt || latest.deadlineAt !== task.deadlineAt)
            throw new Error('Даты задачи изменились. Открой её снова.');
          if (due !== originalDue) next = updateTaskSettings(next, task.id, { deadlineAt: deadlineAt ?? null, allowPastDeadline: true });
          if (day !== originalDate) next = moveWeekTask(next, task.id, day || null, ownerId, late);
        }
        return slot === previousSlot ? next : linkWeekTask(next, week, task.id, slot === -1 ? null : slot, ownerId);
      });
      close();
    }}>
      <div className="week-plan-dates">
        <label>День выполнения<input type="date" value={day} disabled={task.done} onChange={e => setDay(e.target.value)} /></label>
        <label>Дедлайн<input type="date" value={due} disabled={task.done} onChange={e => setDue(e.target.value)} /></label>
      </div>
      {late && <p className="week-plan-warning" role="status">День выполнения позже дедлайна.</p>}
      <label>Результат недели<select aria-label="Результат недели" value={slot} onChange={e => setSlot(Number(e.target.value))}>
        <option value={-1}>Без привязки</option>
        {outcomes.map((outcome, index) => outcome && <option key={index} value={index}>{outcome.title}</option>)}
      </select></label>
      <div className="week-plan-actions"><button type="button" onClick={onOpen}>Открыть задачу</button><button type="submit">Сохранить</button></div>
    </form>
  </Modal>;
}

function WeekOutcomeEditor({ current, tasks, submit, close }: {
  current: string; tasks: Quest[]; submit: (title: string) => void; close: () => void;
}) {
  const [title, setTitle] = useState(current);
  return <Modal title="Результат недели" close={close}>
    <form onSubmit={event => { event.preventDefault(); if (title.trim()) submit(title); }}>
      <label>Название результата<input required maxLength={WEEK_OUTCOME_TITLE_LIMIT} value={title} onChange={e => setTitle(e.target.value)} /></label>
      <div><h4>Связанные задачи</h4>
        {tasks.length ? <ul>{tasks.map(q => <li key={q.id}>{q.done ? '✓ ' : ''}{q.name}</li>)}</ul>
          : <p>Выбери этот результат в карточке задачи недельного плана.</p>}
      </div>
      <div className="week-plan-actions"><button type="button" onClick={close}>Отмена</button><button type="submit">Сохранить</button></div>
    </form>
  </Modal>;
}

function WeekTime({ days, projects, total }: {
  days: ReturnType<typeof weekPlanDays>['days']; projects: { id: string; name: string; duration: number }[]; total: number;
}) {
  const free = days.reduce((sum, day) => sum + Math.max(0, WAKING_MINUTES - day.planned), 0);
  const excess = days.reduce((sum, day) => sum + Math.max(0, day.planned - WAKING_MINUTES), 0);
  return <aside className="week-plan-time" aria-label="Свободное время и нагрузка">
    <section className="week-plan-time-hero"><h3>Свободное время</h3>
      <strong aria-live="polite">{minutes(free)}</strong>
      <small>За неделю после сна и задач с датой</small>
      <small>{SLEEP_HOURS} ч сна · {24 - SLEEP_HOURS} ч бодрствования в день</small>
      {excess > 0 && <small className="week-plan-warning">Сверх доступного времени по дням · {minutes(excess)}</small>}
    </section>
    <section className="week-plan-chart"><h3>Баланс по дням</h3>
      <p className="week-plan-chart-legend"><span>■</span> Задачи <span>■</span> Свободно</p>
      <ul>{days.map(day => {
        const balance = WAKING_MINUTES - day.planned;
        const used = Math.min(1, day.planned / WAKING_MINUTES) * 100;
        return <li className="week-plan-balance" key={day.day}
          title={short(day.day) + ' · задачи ' + minutes(day.planned) + ' · ' + (balance < 0 ? 'перегрузка ' : 'свободно ') + minutes(Math.abs(balance))}>
          <span>{weekday(day.day)}</span><span className="week-plan-bar is-balance" aria-label={'Задачи ' + minutes(day.planned)}>
            <span style={{ width: used + '%', background: balance < 0 ? 'var(--week-warning)' : undefined }} />
          </span><span className={balance < 0 ? 'week-plan-warning' : ''}>{balance < 0 ? '−' : ''}{minutes(Math.abs(balance))}</span>
        </li>;
      })}</ul>
    </section>
    <section className="week-plan-chart"><h3>Время по проектам</h3>
      {projects.length ? <>
        <div className="week-plan-bar" aria-hidden="true">{projects.map((project, index) => <span key={project.id} style={{ width: (project.duration / total * 100) + '%', background: projectColors[index % projectColors.length] }} />)}</div>
        <ul>{projects.map((project, index) => <li className="week-plan-project" key={project.id}>
          <span className="week-plan-dot" style={{ background: projectColors[index % projectColors.length] }} />
          <span>{project.name}</span><span>{minutes(project.duration)}</span>
        </li>)}</ul>
      </> : <small>На неделю пока нет задач с оценкой.</small>}
    </section>
  </aside>;
}

export default function WeekPlanBoard({ state, ownerId, today, week, apply, changeWeek, openTask, newTask, openReview, showList }: Props) {
  const { days, backlog } = weekPlanDays(state, week, ownerId);
  const [taskId, setTaskId] = useState('');
  const [goalIndex, setGoalIndex] = useState<number | null>(null);
  const [dragged, setDragged] = useState('');
  const [target, setTarget] = useState<string | null>(null);
  const tasks = state.quests.filter(q => !q.ownerId || q.ownerId === ownerId);
  const outcomes = weekOutcomes(state, week);
  const total = days.reduce((sum, day) => sum + day.planned, 0);
  const budget = days.reduce((sum, day) => sum + day.budget, 0);
  const unknown = days.flatMap(day => day.tasks).filter(q => !q.estimateMinutes).length;
  const projects = new Map<string, { id: string; name: string; duration: number }>();
  const projectNames = new Map(state.goals.map(goal => [goal.id, goal.name]));
  for (const q of days.flatMap(day => day.tasks)) {
    if (!q.estimateMinutes) continue;
    const id = q.goalId ?? '';
    const previous = projects.get(id);
    projects.set(id, { id, name: projectNames.get(id) ?? 'Без проекта', duration: (previous?.duration ?? 0) + q.estimateMinutes });
  }
  const projectHours = [...projects.values()].sort((a, b) => b.duration - a.duration);
  const editedTask = tasks.find(q => q.id === taskId);
  function move(id: string, day: string | null) {
    const task = tasks.find(q => q.id === id);
    if (!task || (taskDay(task) ?? null) === day) return;
    const late = !!day && weekMoveIsLate(task, day);
    if (late && !window.confirm('День выполнения позже дедлайна. Перенести задачу?')) return;
    apply(current => moveWeekTask(current, id, day, ownerId, late), late ? 'Задача перенесена за дедлайн' : 'Задача перенесена');
  }
  function dropProps(day: string) {
    return {
      'data-drop-active': !!dragged && target === day,
      onDragOver: (e: DragEvent) => {
        if (!dragged) return;
        e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setTarget(day);
      },
      onDragLeave: (e: DragEvent<HTMLElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setTarget(null);
      },
      onDrop: (e: DragEvent) => {
        if (!dragged) return;
        e.preventDefault();
        move(dragged, day || null);
        setDragged(''); setTarget(null);
      },
    };
  }
  function card(q: Quest) {
    const late = taskFinishesAfterDeadline(q);
    const due = planningDay(q.deadlineAt);
    return <button type="button" key={q.id} data-week-task={q.id} className="week-plan-task" data-done={q.done} data-late={late}
      draggable={!q.done} onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', q.id); setDragged(q.id); }}
      onDragEnd={() => { setDragged(''); setTarget(null); }} onClick={() => setTaskId(q.id)}>
      <span>{q.done ? '✓ ' : ''}{q.name}</span>
      <small>{projectNames.get(q.goalId ?? '') ?? 'Без проекта'} · {q.estimateMinutes ? minutes(q.estimateMinutes) : 'Нет оценки'}</small>
      {due && <small className={late ? 'week-plan-warning' : ''}>{late ? 'После дедлайна' : 'Срок'} · {short(due)}</small>}
    </button>;
  }
  function column(day: typeof days[number], compact = false) {
    const over = day.planned - day.budget;
    return <section className="week-plan-day" key={day.day} aria-label={full(day.day)} data-today={day.day === today} data-over={over > 0} {...dropProps(day.day)}>
      <header><h4>{weekday(day.day)} <time dateTime={day.day}>{date(day.day).getDate()}</time></h4>
        <small>{compact && !day.planned && !day.budget ? 'Выходной' : minutes(day.planned) + ' / ' + minutes(day.budget)}</small>
        {over > 0 && <small className="week-plan-warning">Сверх бюджета · {minutes(over)}</small>}
      </header>
      <div className="week-plan-cards">{day.tasks.map(card)}</div>
      <button type="button" className="week-plan-add" aria-label={'Добавить задачу на ' + full(day.day)} onClick={() => newTask(day.day)}>+ Добавить</button>
    </section>;
  }
  const linkedTasks = (ids: string[] = []) => tasks.filter(task => ids.includes(task.id) && !task.planning?.archivedAt && !task.wontDo);
  return <section className="week-plan" aria-label="План недели">
    <header className="week-plan-head"><h3>{short(week)} — {full(addDays(week, 6))}</h3>
      <div className="week-plan-actions">
        <button type="button" onClick={() => changeWeek(mondayOf(today))}>К текущей</button>
        <button type="button" aria-label="Предыдущая неделя" onClick={() => changeWeek(addDays(week, -7))}>‹</button>
        <button type="button" aria-label="Следующая неделя" onClick={() => changeWeek(addDays(week, 7))}>›</button>
        <button type="button" onClick={showList}>Список</button>
        <button type="button" className="week-plan-review" onClick={openReview}>Итоги недели</button>
      </div>
    </header>
    <div className="week-plan-layout">
      <div className="week-plan-main">
        <section aria-label="Три главных результата недели">
          <h3>Три главных результата недели</h3>
          <div className="week-plan-outcomes">{outcomes.map((outcome, index) => {
            const linked = linkedTasks(outcome?.taskIds);
            const done = linked.filter(q => q.done).length;
            return <button key={index} type="button" data-outcome={index}
              aria-label={outcome ? undefined : 'Добавить результат недели ' + (index + 1)} onClick={() => setGoalIndex(index)}>
              <span>{outcome?.title ?? '+ Добавить результат'}</span>
              {outcome && <><small>{linked.length ? done + ' из ' + linked.length + ' выполнено' : 'Пока без задач'}</small>
                <span className="week-plan-bar" aria-hidden="true"><span style={{ width: (linked.length ? done / linked.length * 100 : 0) + '%' }} /></span></>}
            </button>;
          })}</div>
        </section>
        <div className="week-plan-figures" aria-label="Бюджет недели">
          <span>Запланировано<strong>{minutes(total)}</strong></span>
          <span>Бюджет плана<strong>{minutes(budget)}</strong></span>
          <span>{total > budget ? 'Сверх бюджета' : 'Осталось в бюджете'}<strong>{minutes(Math.abs(budget - total))}</strong></span>
        </div>
        {unknown > 0 && <small>Задач без оценки: {unknown}. Свободное время рассчитано по известным оценкам.</small>}
        <div className="week-plan-days">{days.slice(0, 5).map(day => column(day))}</div>
        <div className="week-plan-weekend">{days.slice(5).map(day => column(day, true))}</div>
        <section className="week-plan-backlog" {...dropProps('')}>
          <div className="week-plan-head"><h3>Без даты · {backlog.length}</h3><button type="button" onClick={() => newTask()}>+ Задача без даты</button></div>
          <div className="week-plan-cards">{backlog.map(card)}</div>
          {!backlog.length && <small>Нет задач без даты.</small>}
        </section>
      </div>
      <WeekTime days={days} projects={projectHours} total={total} />
    </div>
    {editedTask && <WeekTaskEditor key={editedTask.id} task={editedTask} state={state} week={week} ownerId={ownerId} apply={apply}
      close={() => setTaskId('')} onOpen={() => { setTaskId(''); openTask(editedTask.id); }} />}
    {goalIndex !== null && <WeekOutcomeEditor key={goalIndex} current={outcomes[goalIndex]?.title ?? ''}
      tasks={linkedTasks(outcomes[goalIndex]?.taskIds)} close={() => setGoalIndex(null)}
      submit={title => { apply(current => saveWeekOutcome(current, week, goalIndex, title), 'Результат недели сохранён'); setGoalIndex(null); }} />}
  </section>;
}
