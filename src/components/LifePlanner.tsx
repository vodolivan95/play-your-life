import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { completeQuest, dateKey, spheres } from '../game';
import type { GameState, Quest } from '../game';
import {
  formatDate,
  isGoalTask,
  goalStatus,
  periodItems,
  planCalendar,
  saveTask,
} from '../planning';
import type { PlanScope } from '../planning';
import { TaskForm } from './PlanningForms';
import TickTickTransfer from './TickTickTransfer';
import Icon from './Icon';
export default function LifePlanner({
  state,
  onChange,
  onGoal,
  onNewGoal,
  onNotify,
}: {
  state: GameState;
  onChange: Dispatch<SetStateAction<GameState>>;
  onGoal: (id: string) => void;
  onNewGoal: () => void;
  onNotify: (message: string) => void;
}) {
  const [scope, setScope] = useState<PlanScope>('month');
  const [anchor, setAnchor] = useState(dateKey);
  const [showDone, setShowDone] = useState(false);
  const [editor, setEditor] = useState<
    { kind: 'task'; task?: Quest } | { kind: 'transfer' } | null
  >(() =>
    location.hash.startsWith('#ticktick=') ? { kind: 'transfer' } : null,
  );
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (editor) dialog.current?.showModal();
    else dialog.current?.close();
  }, [editor]);
  const period = periodItems(state, scope, anchor);
  const tasks = period.tasks.filter((q) => showDone || !q.done);
  const groups = new Map<string, Quest[]>();
  for (const task of tasks) {
    const key =
      (task.startsAt ?? task.dueAt)
        ? dateKey(new Date(task.startsAt ?? task.dueAt!))
        : 'Без даты';
    groups.set(key, [...(groups.get(key) ?? []), task]);
  }
  function shift(amount: number) {
    const date = new Date(`${anchor}T12:00:00`);
    if (scope === 'year') date.setFullYear(date.getFullYear() + amount);
    else if (scope === 'month') {
      date.setDate(1);
      date.setMonth(date.getMonth() + amount);
    } else date.setDate(date.getDate() + amount * (scope === 'week' ? 7 : 1));
    setAnchor(dateKey(date));
  }
  function download() {
    const blob = new Blob([planCalendar(period.tasks, state)], {
      type: 'text/calendar;charset=utf-8',
    });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `play-your-life-${anchor}.ics`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    onNotify('План скачан для календаря');
  }
  function row(task: Quest) {
    const sphere = spheres.find((s) => s.id === task.sphere)!;
    const goal = state.goals.find((g) => g.id === task.goalId);
    return (
      <div
        className={`planned-task ${task.done ? 'completed' : ''}`}
        key={task.id}
      >
        <button
          className={`check-button ${task.done ? 'checked' : ''}`}
          disabled={task.done}
          aria-label={`Выполнить: ${task.name}`}
          onClick={() => {
            const next = completeQuest(state, task.id);
            onChange(next);
            if (next.xp > state.xp)
              onNotify(`+${next.xp - state.xp} XP · Шаг сделан!`);
          }}
        >
          <Icon name="check" size={16} />
        </button>
        <div>
          <strong>{task.name}</strong>
          <small>
            {sphere.icon} {goal?.name ?? sphere.name}
          </small>
          <small>
            {formatDate(task.startsAt ?? task.dueAt)}
            {task.estimateMinutes ? ` · ${task.estimateMinutes} мин` : ''}
            {task.dueAt && !task.done && new Date(task.dueAt) < new Date()
              ? ' · Срок прошёл'
              : ''}
          </small>
        </div>
        <span className="xp-tag">+{task.xp} XP</span>
        {!task.done && (
          <button
            className="icon-button"
            aria-label={`Изменить: ${task.name}`}
            onClick={() => setEditor({ kind: 'task', task })}
          >
            ✎
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="life-planner">
      <section className="life-plan-intro">
        <div className="eyebrow">ТВОЁ ВРЕМЯ. ТВОИ ПРИОРИТЕТЫ.</div>
        <h2>
          От большого направления
          <br />к сегодняшнему шагу.
        </h2>
        <p>
          Свяжи цели, этапы и задачи. Выдели время для того, что делает твою
          жизнь твоей.
        </p>
        <div>
          <button className="primary-button" onClick={onNewGoal}>
            Новая цель
            <Icon name="plus" size={16} />
          </button>
          <button
            className="secondary-button"
            onClick={() => setEditor({ kind: 'task' })}
          >
            Запланировать задачу
          </button>
          <button
            className="secondary-button"
            onClick={() => setEditor({ kind: 'transfer' })}
          >
            TickTick
          </button>
        </div>
      </section>
      <div className="plan-toolbar">
        <div className="tabs plan-scopes">
          {[
            ['day', 'День'],
            ['week', 'Неделя'],
            ['month', 'Месяц'],
            ['year', 'Год'],
            ['all', 'Весь путь'],
          ].map(([id, label]) => (
            <button
              key={id}
              className={scope === id ? 'selected' : ''}
              onClick={() => setScope(id as PlanScope)}
            >
              {label}
            </button>
          ))}
        </div>
        {scope !== 'all' && (
          <div className="plan-date-navigation">
            <button
              className="icon-button outlined"
              aria-label="Предыдущий период"
              onClick={() => shift(-1)}
            >
              ←
            </button>
            <input
              type="date"
              aria-label="Дата плана"
              value={anchor}
              onChange={(e) => {
                if (e.target.value) setAnchor(e.target.value);
              }}
            />
            <button
              className="icon-button outlined"
              aria-label="Следующий период"
              onClick={() => shift(1)}
            >
              <Icon name="arrow" size={16} />
            </button>
          </div>
        )}
      </div>
      <div className="planning-stats">
        <div>
          <b>{period.goals.length}</b>
          <span>Целей в периоде</span>
        </div>
        <div>
          <b>{period.tasks.filter((q) => !q.done).length}</b>
          <span>Запланированных задач</span>
        </div>
        <div>
          <b>{Number(period.hours.toFixed(1))} ч</b>
          <span>Времени для внимания</span>
        </div>
      </div>
      <section className="panel plan-goals">
        <div className="section-heading">
          <div>
            <h2>Направления и цели</h2>
            <p>
              {scope === 'all'
                ? 'Весь твой путь, включая цели без срока.'
                : `${period.start.toLocaleDateString('ru-RU')} — ${new Date(period.end.getTime() - 1).toLocaleDateString('ru-RU')}`}
            </p>
          </div>
        </div>
        {period.goals.map((goal) => (
          <button
            className="plan-goal-row"
            key={goal.id}
            onClick={() => onGoal(goal.id)}
          >
            <span className="sphere-icon">
              {spheres.find((s) => s.id === goal.sphere)?.icon}
            </span>
            <div>
              <strong>{goal.name}</strong>
              <small>
                {goalStatus(goal)} · {formatDate(goal.dueAt)}
              </small>
              <div className="progress">
                <span
                  style={{ width: `${(goal.current / goal.target) * 100}%` }}
                />
              </div>
            </div>
            <b>{Math.round((goal.current / goal.target) * 100)}%</b>
            <Icon name="arrow" size={17} />
          </button>
        ))}
        {period.goals.length === 0 && (
          <p className="plan-empty">
            В этом периоде пока нет целей со сроком. Открой «Весь путь» или
            добавь направление.
          </p>
        )}
      </section>
      <section className="panel planned-days">
        <div className="section-heading">
          <div>
            <h2>Реальные шаги</h2>
            <p>Выполнение здесь обновляет цель, XP и итоги месяца.</p>
          </div>
          <label className="show-done">
            <input
              type="checkbox"
              checked={showDone}
              onChange={(e) => setShowDone(e.target.checked)}
            />
            Готовые
          </label>
        </div>
        {[...groups].map(([key, items]) => (
          <div className="planned-day" key={key}>
            <h3>
              {key === 'Без даты'
                ? key
                : new Date(`${key}T12:00:00`).toLocaleDateString('ru-RU', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
            </h3>
            {items.map(row)}
          </div>
        ))}
        {tasks.length === 0 && (
          <p className="plan-empty">
            Здесь появятся задачи с датами выбранного периода.
          </p>
        )}
        <div className="plan-export-buttons">
          <button
            className="secondary-button"
            disabled={
              !period.tasks.some((q) => !q.done && isGoalTask(state, q))
            }
            onClick={() => setEditor({ kind: 'transfer' })}
          >
            Передать в TickTick
          </button>
          <button
            className="text-button"
            disabled={
              !period.tasks.some((q) => !q.done && (q.startsAt || q.dueAt))
            }
            onClick={download}
          >
            Скачать в календарь
          </button>
        </div>
      </section>
      {scope !== 'all' && period.unscheduled.length > 0 && (
        <section className="panel unscheduled-tasks">
          <div className="section-heading">
            <div>
              <h2>Пока без даты</h2>
              <p>Добавь дату или свяжи задачу с целью кнопкой изменения.</p>
            </div>
            <span className="count-chip">{period.unscheduled.length}</span>
          </div>
          {period.unscheduled.map(row)}
        </section>
      )}
      <dialog
        ref={dialog}
        onCancel={() => setEditor(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setEditor(null);
        }}
      >
        <div className="dialog-content">
          <button
            className="icon-button modal-close"
            aria-label="Закрыть"
            onClick={() => setEditor(null)}
          >
            <Icon name="close" />
          </button>
          {editor?.kind === 'task' && (
            <TaskForm
              state={state}
              initial={editor.task}
              anchor={anchor}
              onSave={(input) => {
                onChange(saveTask(state, input));
                setEditor(null);
                onNotify('Задача запланирована');
              }}
            />
          )}
          {editor?.kind === 'transfer' && (
            <TickTickTransfer
              state={state}
              tasks={period.tasks}
              onChange={onChange}
            />
          )}
        </div>
      </dialog>
    </div>
  );
}
