import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  spheres,
  updateGoal,
} from '../game';
import type { GameState, Goal, GoalStage, Quest } from '../game';
import {
  durationLabel,
  formatDate,
  goalStatus,
  saveGoal,
  saveStage,
  saveTask,
  moveStage,
} from '../planning';
import { GoalForm, StageForm, TaskForm } from './PlanningForms';
import TickTickTransfer from './TickTickTransfer';
import Icon from './Icon';
import GameArt from './GameArt';
import ProjectArt from './ProjectArt';
import GoalWorkspace from './GoalWorkspace';
import { goalProgressValue } from '../goalWorkspace';
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
  backLabel = '← Все цели',
  stageId,
  onSphere,
  ownerId,
}: {
  state: GameState;
  onChange: Dispatch<SetStateAction<GameState>>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onNew: () => void;
  onNotify: (message: string) => void;
  backLabel?: string;
  stageId?: string;
  ownerId: string;
  onSphere: (id: string) => void;
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
  function main(id: string) {
    onChange((s) => ({ ...s, mainGoalId: id })); onNotify('Главная цель выбрана');
  }
  const visibleGoals = state.goals.filter(
    (g) =>
      goalFilter === 'all' ||
      (goalFilter === 'done' ? g.current >= g.target : g.current < g.target),
  );
  const progress = (g: Goal) => Math.round(goalProgressValue(state, g));
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
              {backLabel}
            </button>
          )}
        </div>
        <button className="primary-button" onClick={onNew}>
          <Icon name="plus" size={17} /> Новая цель
        </button>
      </div>
      {selectedId && !goal && <div className="panel"><h2>Цель не найдена</h2><p>Проверьте ссылку или выберите цель из своей игры.</p><button className="text-button" onClick={() => onSelect(null)}>Все цели →</button></div>}
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
                  <span className="sphere-icon">
                    {g.image ? (
                      <ProjectArt
                        name={g.name}
                        sphere={g.sphere}
                        image={g.image}
                      />
                    ) : (
                      <GameArt
                        kind={g.sphere === 'english' ? 'target' : g.sphere}
                      />
                    )}
                  </span>
                  <span
                    className={`mini-pill ${goalStatus(g) === 'Срок прошёл' ? 'overdue-pill' : ''}`}
                  >
                    {goalStatus(g)}
                  </span>
                </div>
                <small className="muted">
                  {sphere.name} · {durationLabel(g.startsAt, g.dueAt)}
                </small>
                <h2>
                  <button
                    className="goal-title-link"
                    onClick={() => onSelect(g.id)}
                  >
                    {g.name}
                  </button>
                </h2>

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
                  <summary>Прогресс и сроки</summary>{' '}
                  <button
                    className="text-button main-goal-button"
                    aria-pressed={mainGoal?.id === g.id}
                    onClick={() => main(g.id)}
                  >
                    {mainGoal?.id === g.id
                      ? '★ Главная цель'
                      : '☆ Сделать главной'}
                  </button>
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
        <GoalWorkspace ownerId={ownerId} key={`${goal.id}:${stageId ?? 'goal'}`} state={state} goal={goal} stageId={stageId} onChange={onChange}
          onEditGoal={() => setEditor({ kind: 'goal' })} onEditStage={stage => setEditor({ kind: 'stage', stage })}
          onAddTask={stageId => setEditor({ kind: 'task', stageId })} onEditTask={task => setEditor({ kind: 'task', task })}
          onTransfer={task => setEditor({ kind: 'transfer', task })} onNotify={onNotify} onSelect={onSelect} onSphere={onSphere} />
      )}
      <dialog
        aria-label={
          editor?.kind === 'stage'
            ? 'Настройка этапа'
            : editor?.kind === 'task'
              ? 'Настройка задачи'
              : editor?.kind === 'transfer'
                ? 'Подключение TickTick'
                : 'Настройка цели'
        }
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
              onSave={(input, position) => {
                let next = saveStage(state, goal.id, input);
                const savedId = input.id ?? next.goals.find(g => g.id === goal.id)!.stages!.at(-1)!.id;
                if (position !== undefined) next = moveStage(next, goal.id, savedId, position);
                onChange(next);
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
