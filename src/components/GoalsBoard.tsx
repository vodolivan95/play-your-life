import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, Dispatch, SetStateAction } from 'react';
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
import {
  deadlineLabel,
  goalDaysLeft,
  goalNextStep,
  goalSortNames,
  goalsSummary,
  isGoalDone,
  pluralDays,
  sortGoals,
} from '../goalsOverview';
import type { GoalSort } from '../goalsOverview';
import './GoalsOverview.css';
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
  const [sphereFilter, setSphereFilter] = useState('all');
  const [sort, setSort] = useState<GoalSort>('due');
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
  const visibleGoals = sortGoals(
    state,
    state.goals.filter(
      (g) =>
        (sphereFilter === 'all' || g.sphere === sphereFilter) &&
        (goalFilter === 'all' ||
          (goalFilter === 'done' ? isGoalDone(g) : !isGoalDone(g))),
    ),
    sort,
  );
  const usedSpheres = spheres.filter((sp) =>
    state.goals.some((g) => g.sphere === sp.id),
  );
  const summary = goalsSummary(state, state.goals);
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
        <>
          <div className="gl-summary">
            <div className="gl-tile">
              <b>{summary.active}</b>
              <span>Активные цели</span>
            </div>
            <div className="gl-tile">
              <b>{summary.averageProgress}%</b>
              <span>Средний прогресс</span>
            </div>
            <div className="gl-tile">
              <b>
                {summary.nearestDays === undefined
                  ? '—'
                  : summary.nearestDays === 0
                    ? 'Сегодня'
                    : pluralDays(summary.nearestDays)}
              </b>
              <span>До ближайшего срока</span>
            </div>
            <div className="gl-tile">
              <b>+{summary.pendingReward} XP</b>
              <span>Награды впереди</span>
            </div>
          </div>
          <div className="gl-filters">
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
            {usedSpheres.length > 1 && (
              <div className="gl-chips" role="group" aria-label="Сфера цели">
                {[{ id: 'all', name: 'Все сферы' }, ...usedSpheres].map((sp) => (
                  <button
                    key={sp.id}
                    className={sphereFilter === sp.id ? 'selected' : ''}
                    aria-pressed={sphereFilter === sp.id}
                    onClick={() => setSphereFilter(sp.id)}
                  >
                    {sp.name}
                  </button>
                ))}
              </div>
            )}
            <label className="gl-sort">
              <span>Порядок</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as GoalSort)}
              >
                {(Object.keys(goalSortNames) as GoalSort[]).map((id) => (
                  <option key={id} value={id}>
                    {goalSortNames[id]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}
      {!goal ? (
        <div className="gl-list">
          {visibleGoals.map((g) => {
            const sphere = spheres.find((s) => s.id === g.sphere)!;
            const days = goalDaysLeft(g);
            const late = !isGoalDone(g) && days !== undefined && days < 0;
            const next = goalNextStep(state, g);
            const isMain = mainGoal?.id === g.id;
            return (
              <section
                className={`gl-card ${isMain ? 'is-main' : ''}`}
                key={g.id}
                style={{ '--gl-color': sphere.color } as CSSProperties}
              >
                <div className="gl-head">
                  <span className="sphere-icon gl-icon">
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
                  <div className="gl-title">
                    <h2>
                      <button
                        className="goal-title-link"
                        onClick={() => onSelect(g.id)}
                      >
                        {g.name}
                      </button>
                    </h2>
                    <div className="gl-tags">
                      <span className="gl-tag">{sphere.name}</span>
                      <span className={`gl-tag ${late ? 'is-late' : ''}`}>
                        {goalStatus(g)}
                      </span>
                      {isMain && <span className="gl-tag is-main">★ Главная</span>}
                    </div>
                  </div>
                  <div className={`gl-deadline ${late ? 'is-late' : ''}`}>
                    <small>Срок</small>
                    <b>
                      {g.dueAt
                        ? new Date(g.dueAt).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                          })
                        : 'Без срока'}
                    </b>
                    <span>{deadlineLabel(g)}</span>
                  </div>
                </div>
                <div className="gl-progress">
                  <div className="gl-progress-label">
                    <span>
                      {g.progressMode === 'tasks'
                        ? `${state.quests.filter((q) => q.goalId === g.id && q.done).length} из ${state.quests.filter((q) => q.goalId === g.id).length} задач`
                        : `${g.current} из ${g.target}`}
                    </span>
                    <b>{progress(g)}%</b>
                  </div>
                  <div
                    className="gl-bar"
                    role="progressbar"
                    aria-label={`Прогресс цели «${g.name}»`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress(g)}
                  >
                    <span style={{ width: `${progress(g)}%` }} />
                  </div>
                </div>
                <div className="gl-foot">
                  <p className="gl-next">
                    {next ? (
                      <>
                        {next.kind === 'task' ? 'Следующий шаг' : 'Текущий этап'}:{' '}
                        <b>{next.text}</b>
                      </>
                    ) : isGoalDone(g) ? (
                      'Цель достигнута'
                    ) : (
                      'Добавьте первый шаг в плане цели'
                    )}
                  </p>
                  <span className="gl-reward">
                    🏆 {g.reward} XP{g.rewarded ? ' · получены' : ''}
                  </span>
                </div>
                <details className="goal-controls">
                  <summary>Прогресс и сроки</summary>{' '}
                  <button
                    className="text-button main-goal-button"
                    aria-pressed={isMain}
                    onClick={() => main(g.id)}
                  >
                    {isMain ? '★ Главная цель' : '☆ Сделать главной'}
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
                    <small>
                      Срок: {formatDate(g.dueAt)} ·{' '}
                      {durationLabel(g.startsAt, g.dueAt)}
                    </small>
                  </div>
                </details>
                <button
                  className="primary-button gl-plan"
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
