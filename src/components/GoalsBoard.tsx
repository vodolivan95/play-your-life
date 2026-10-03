import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  completeQuest,
  removeQuest,
  spheres,
  syncGoalTasks,
  updateGoal,
} from '../game';
import type { GameState, Goal, GoalStage, Quest } from '../game';
import {
  deleteGoal,
  durationLabel,
  formatDate,
  goalStatus,
  removeStage,
  saveGoal,
  saveStage,
  saveTask,
} from '../planning';
import { GoalForm, StageForm, TaskForm } from './PlanningForms';
import TickTickTransfer from './TickTickTransfer';
import Icon from './Icon';
type Editor =
  | { kind: 'goal' }
  | { kind: 'stage'; stage?: GoalStage }
  | { kind: 'task'; task?: Quest; stageId?: string }
  | { kind: 'transfer'; task?: Quest };
export default function GoalsBoard({
  state,
  onChange,
  selectedId,
  onSelect,
  onNew,
  onNotify,
}: {
  state: GameState;
  onChange: Dispatch<SetStateAction<GameState>>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onNew: () => void;
  onNotify: (message: string) => void;
}) {
  const [goalFilter, setGoalFilter] = useState('active');
  const [editor, setEditor] = useState<Editor | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (editor) dialog.current?.showModal();
    else dialog.current?.close();
  }, [editor]);
  const goal = state.goals.find((g) => g.id === selectedId);
  const mainGoal =
    state.goals.find((g) => g.id === state.mainGoalId) ??
    state.goals.find((g) => !g.rewarded) ??
    state.goals[0];
  const tasks = state.quests.filter((q) => q.goalId === goal?.id && !!goal);
  const done = tasks.filter((q) => q.done).length;
  function finish(task: Quest) {
    const next = completeQuest(state, task.id);
    onChange(next);
    if (next.xp > state.xp)
      onNotify(`+${next.xp - state.xp} XP · Шаг к цели сделан!`);
  }
  function main(id: string) {
    onChange((s) => ({ ...s, mainGoalId: id }));
    onNotify('Главная цель выбрана');
  }
  function taskRow(task: Quest) {
    return (
      <div
        className={`planned-task ${task.done ? 'completed' : ''}`}
        key={task.id}
      >
        <button
          className={`check-button ${task.done ? 'checked' : ''}`}
          disabled={task.done}
          aria-label={`Выполнить: ${task.name}`}
          onClick={() => finish(task)}
        >
          <Icon name="check" size={17} />
        </button>
        <div>
          <strong>{task.name}</strong>
          <small>
            {task.dueAt ? formatDate(task.dueAt) : 'Без срока'}
            {task.estimateMinutes ? ` · ${task.estimateMinutes} мин` : ''}
            {task.priority === 'high' ? ' · Главный фокус' : ''}
          </small>
          {task.tickTickSharedAt && (
            <small className="transfer-label">
              Отмечена как перенесённая в TickTick
            </small>
          )}
        </div>
        <span className="xp-tag">+{task.xp} XP</span>
        <div className="task-actions">
          {!task.done && (
            <>
              <button
                className="icon-button"
                aria-label={`Изменить: ${task.name}`}
                onClick={() => setEditor({ kind: 'task', task })}
              >
                ✎
              </button>
              <button
                className="icon-button"
                aria-label={`Передать: ${task.name}`}
                onClick={() => setEditor({ kind: 'transfer', task })}
              >
                <Icon name="arrow" size={16} />
              </button>
            </>
          )}
          <button
            className="icon-button delete"
            aria-label={`Удалить: ${task.name}`}
            onClick={() => {
              if (
                window.confirm(
                  'Удалить задачу из плана? Уже заработанный XP и история сохранятся.',
                )
              )
                onChange((s) => removeQuest(s, task.id));
            }}
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
      </div>
    );
  }
  const visibleGoals = state.goals.filter(
    (g) =>
      goalFilter === 'all' ||
      (goalFilter === 'done' ? g.current >= g.target : g.current < g.target),
  );
  const progress = (g: Goal) => Math.round((g.current / g.target) * 100);
  return (
    <>
      <div className="page-toolbar">
        <div>
          <p className="muted">
            {goal
              ? 'Большая цель становится понятными шагами.'
              : 'Сферы жизни → цели → этапы → задачи.'}
          </p>
          {goal && (
            <button
              className="text-button back-link"
              onClick={() => onSelect(null)}
            >
              ← Все цели
            </button>
          )}
        </div>
        <button className="primary-button" onClick={onNew}>
          <Icon name="plus" size={17} /> Новая цель
        </button>
      </div>
      {!goal && (
        <div className="tabs goal-tabs">
          {[
            ['active', 'Активные'],
            ['done', 'Достигнутые'],
            ['all', 'Все'],
          ].map(([id, name]) => (
            <button
              key={id}
              className={goalFilter === id ? 'selected' : ''}
              onClick={() => setGoalFilter(id)}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {!goal ? (
        <div className="goals-grid">
          {visibleGoals.map((g) => {
            const sphere = spheres.find((s) => s.id === g.sphere)!;
            return (
              <section className="panel goal-card" key={g.id}>
                <div className="section-heading">
                  <span className="sphere-icon">{sphere.icon}</span>
                  <span
                    className={`mini-pill ${goalStatus(g) === 'Срок прошёл' ? 'overdue-pill' : ''}`}
                  >
                    {goalStatus(g)}
                  </span>
                </div>
                <small className="muted">
                  {sphere.name} · {durationLabel(g.startsAt, g.dueAt)}
                </small>
                <h2>{g.name}</h2>
                <button
                  className="text-button main-goal-button"
                  aria-pressed={mainGoal?.id === g.id}
                  onClick={() => main(g.id)}
                >
                  {mainGoal?.id === g.id
                    ? '★ Главная цель'
                    : '☆ Сделать главной'}
                </button>
                <div className="goal-progress-label">
                  <span>
                    {g.progressMode === 'tasks'
                      ? `${state.quests.filter((q) => q.goalId === g.id && q.done).length} / ${state.quests.filter((q) => q.goalId === g.id).length} задач`
                      : `${g.current} / ${g.target}`}
                  </span>
                  <b>{progress(g)}%</b>
                </div>
                <div className="progress">
                  <span style={{ width: `${progress(g)}%` }} />
                </div>
                <details className="goal-controls">
                  <summary>Прогресс и сроки</summary>
                  {g.progressMode !== 'tasks' && (
                    <label className="goal-input">
                      Текущий прогресс
                      <input
                        type="number"
                        min="0"
                        max={g.target}
                        value={g.current}
                        onChange={(e) => {
                          const next = updateGoal(
                            state,
                            g.id,
                            Number(e.target.value),
                          );
                          onChange(next);
                          if (next.xp > state.xp)
                            onNotify(
                              `Цель достигнута! +${next.xp - state.xp} XP`,
                            );
                        }}
                      />
                    </label>
                  )}
                  <div className="goal-dates-summary">
                    <small>Срок: {formatDate(g.dueAt)}</small>
                    <span>
                      🏆 {g.reward} XP {g.rewarded ? '· Получены' : ''}
                    </span>
                  </div>
                </details>
                <button
                  className="primary-button goal-plan-button"
                  onClick={() => onSelect(g.id)}
                >
                  План цели
                  <Icon name="arrow" size={16} />
                </button>
              </section>
            );
          })}
          {visibleGoals.length === 0 && (
            <div className="panel empty">
              <span>🎯</span>
              <h3>
                {goalFilter === 'done'
                  ? 'Твои победы ещё впереди'
                  : 'Начни с того, что важно'}
              </h3>
              <p>Поставь цель, выбери срок и добавь первый реальный шаг.</p>
            </div>
          )}
        </div>
      ) : (
        <>
          <section className="goal-plan-hero">
            <div>
              <div className="eyebrow">ТВОЁ НАПРАВЛЕНИЕ</div>
              <h2>
                {spheres.find((s) => s.id === goal.sphere)?.icon} {goal.name}
              </h2>
              <p>
                {goal.description ||
                  'Каждая задача — конкретный шаг в твоей жизни.'}
              </p>
              <div className="goal-plan-range">
                <span>
                  {formatDate(goal.startsAt)} → {formatDate(goal.dueAt)}
                </span>
                <b>{durationLabel(goal.startsAt, goal.dueAt)}</b>
              </div>
            </div>
            <div className="goal-plan-progress">
              <b>{progress(goal)}%</b>
              <small>
                {done} из {tasks.length} задач
              </small>
              <div className="progress">
                <span style={{ width: `${progress(goal)}%` }} />
              </div>
            </div>
            <div className="goal-plan-controls">
              <button
                className="secondary-button"
                onClick={() => setEditor({ kind: 'goal' })}
              >
                Настроить цель
              </button>
              <button
                className="secondary-button"
                onClick={() => setEditor({ kind: 'transfer' })}
              >
                Передать в TickTick
              </button>
              <button className="text-button" onClick={() => main(goal.id)}>
                {mainGoal?.id === goal.id
                  ? '★ Главная цель'
                  : '☆ Сделать главной'}
              </button>
            </div>
          </section>
          {goal.progressMode !== 'tasks' && (
            <div className="goal-mode-note">
              <span>
                Прогресс сейчас задаётся числовым результатом. Можно связать его
                с выполнением задач.
              </span>
              <button
                className="text-button"
                onClick={() => {
                  if (
                    window.confirm(
                      'Считать прогресс по задачам? Числовой результат сохранится для возврата через настройки цели.',
                    )
                  )
                    onChange(
                      saveGoal(state, { ...goal, progressMode: 'tasks' }),
                    );
                }}
              >
                Считать по задачам
              </button>
            </div>
          )}
          <div className="section-heading section-gap">
            <div>
              <h2>Этапы твоего пути</h2>
              <p>Разбей большую цель на понятные части.</p>
            </div>
            <button
              className="primary-button"
              onClick={() => setEditor({ kind: 'stage' })}
            >
              <Icon name="plus" size={16} /> Этап
            </button>
          </div>
          {(goal.stages ?? []).map((stage) => {
            const group = tasks.filter((q) => q.stageId === stage.id);
            const finished = group.filter((q) => q.done).length;
            return (
              <section className="panel stage-panel" key={stage.id}>
                <div className="section-heading">
                  <div>
                    <h3>{stage.name}</h3>
                    <p>
                      {formatDate(stage.dueAt)} · {finished}/{group.length}{' '}
                      задач
                    </p>
                  </div>
                  <div className="stage-actions">
                    <button
                      className="icon-button"
                      aria-label={`Изменить этап: ${stage.name}`}
                      onClick={() => setEditor({ kind: 'stage', stage })}
                    >
                      ✎
                    </button>
                    <button
                      className="icon-button delete"
                      aria-label={`Удалить этап: ${stage.name}`}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Удалить этап? Его задачи останутся в цели без этапа.',
                          )
                        )
                          onChange((s) => removeStage(s, goal.id, stage.id));
                      }}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </div>
                <div className="progress stage-progress">
                  <span
                    style={{
                      width: `${group.length ? (finished / group.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                {group.map(taskRow)}
                <button
                  className="text-button add-stage-task"
                  onClick={() => setEditor({ kind: 'task', stageId: stage.id })}
                >
                  + Задача этапа
                </button>
              </section>
            );
          })}
          <section className="panel stage-panel">
            <div className="section-heading">
              <h3>Задачи без этапа</h3>
              <button
                className="text-button"
                onClick={() => setEditor({ kind: 'task' })}
              >
                + Добавить задачу
              </button>
            </div>
            {tasks
              .filter(
                (q) =>
                  !q.stageId || !goal.stages?.some((s) => s.id === q.stageId),
              )
              .map(taskRow)}
            {tasks.length === 0 && (
              <p className="muted">
                Какой маленький шаг ты можешь сделать первым?
              </p>
            )}
          </section>
          <div className="goal-plan-footer">
            <span>
              Награда цели: <b>{goal.reward} XP</b>{' '}
              {goal.rewarded ? '· Уже получена' : ''}
            </span>
            {goal.progressMode === 'tasks' &&
              goal.current >= goal.target &&
              !goal.rewarded &&
              tasks.length > 0 && (
                <button
                  className="primary-button"
                  onClick={() => {
                    const next = syncGoalTasks(state, goal.id, true);
                    onChange(next);
                    if (next.xp > state.xp)
                      onNotify(`+${next.xp - state.xp} XP · Цель достигнута!`);
                  }}
                >
                  Подтвердить достижение
                </button>
              )}
            <button
              className="text-button delete-goal"
              onClick={() => {
                if (
                  window.confirm(
                    'Удалить цель? Задачи останутся самостоятельными, XP и история сохранятся.',
                  )
                ) {
                  onChange((s) => deleteGoal(s, goal.id));
                  onSelect(null);
                }
              }}
            >
              Удалить цель
            </button>
          </div>
        </>
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
          {goal && editor?.kind === 'goal' && (
            <GoalForm
              initial={goal}
              onSave={(input) => {
                onChange(saveGoal(state, input));
                setEditor(null);
                onNotify('Цель обновлена');
              }}
            />
          )}
          {goal && editor?.kind === 'stage' && (
            <StageForm
              goal={goal}
              initial={editor.stage}
              onSave={(input) => {
                onChange(saveStage(state, goal.id, input));
                setEditor(null);
                onNotify('Этап сохранён');
              }}
            />
          )}
          {goal && editor?.kind === 'task' && (
            <TaskForm
              state={state}
              goalId={goal.id}
              stageId={editor.stageId}
              initial={editor.task}
              onSave={(input) => {
                onChange(saveTask(state, input));
                setEditor(null);
                onNotify('Задача добавлена в план');
              }}
            />
          )}
          {goal && editor?.kind === 'transfer' && (
            <TickTickTransfer
              state={state}
              tasks={editor.task ? [editor.task] : tasks}
              onChange={onChange}
            />
          )}
        </div>
      </dialog>
    </>
  );
}
