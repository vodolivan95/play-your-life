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
import { goalProgressValue, stageMetrics } from '../goalWorkspace';
import {
  deadlineLabel,
  goalDaysLeft,
  goalNextStep,
  goalSortNames,
  goalUpcomingTasks,
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
function TileIcon({ kind }: { kind: 'target' | 'trend' | 'calendar' | 'star' }) {
  const paths = {
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" /></>,
    trend: <><path d="M4 17l5-5 4 4 7-8" /><path d="M15 8h5v5" /></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
    star: <path d="M12 3l2.7 5.6 6.1.8-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1L3.2 9.4l6.1-.8z" />,
  };
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[kind]}
    </svg>
  );
}
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
  const [previewId, setPreviewId] = useState<string | null>(null);
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
  const preview = visibleGoals.find((g) => g.id === previewId) ?? visibleGoals[0];
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
              <i className="gl-ico is-blue"><TileIcon kind="target" /></i>
              <div>
                <b>{summary.active}</b>
                <span>Активные цели</span>
              </div>
            </div>
            <div className="gl-tile">
              <i className="gl-ico is-green"><TileIcon kind="trend" /></i>
              <div>
                <b>{summary.averageProgress}%</b>
                <span>Средний прогресс</span>
              </div>
            </div>
            <div className="gl-tile">
              <i className="gl-ico is-orange"><TileIcon kind="calendar" /></i>
              <div>
                <b>
                  {summary.nearestDays === undefined
                    ? 'Нет сроков'
                    : summary.nearestDays === 0
                      ? 'Сегодня'
                      : pluralDays(summary.nearestDays)}
                </b>
                <span>До ближайшего срока</span>
              </div>
            </div>
            <div className="gl-tile">
              <i className="gl-ico is-gold"><TileIcon kind="star" /></i>
              <div>
                <b>+{summary.pendingReward} XP</b>
                <span>Награды впереди</span>
              </div>
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
            {usedSpheres.length > 0 && (
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
        <div className="gl-layout">
        <div className="gl-list">
          {visibleGoals.map((g) => {
            const sphere = spheres.find((s) => s.id === g.sphere)!;
            const days = goalDaysLeft(g);
            const late = !isGoalDone(g) && days !== undefined && days < 0;
            const next = goalNextStep(state, g);
            const isMain = mainGoal?.id === g.id;
            return (
              <section
                className={`gl-card ${isMain ? 'is-main' : ''} ${preview?.id === g.id ? 'is-selected' : ''}`}
                key={g.id}
                onClick={() => setPreviewId(g.id)}
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
                    {(g.dueAt || isGoalDone(g)) && (
                      <span>{deadlineLabel(g)}</span>
                    )}
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
        {preview && (
          <aside className="gl-side" aria-label="Кратко о выбранной цели">
            <div className="gl-side-kicker">Выбранная цель</div>
            <h2>{preview.name}</h2>
            <p className="gl-side-meta">
              {spheres.find((sp) => sp.id === preview.sphere)?.name} ·{' '}
              {deadlineLabel(preview)}
            </p>
            <div className="gl-progress-label">
              <span>Прогресс</span>
              <b>{progress(preview)}%</b>
            </div>
            <div
              className="gl-bar"
              style={
                {
                  '--gl-color': spheres.find((sp) => sp.id === preview.sphere)?.color,
                } as CSSProperties
              }
            >
              <span style={{ width: `${progress(preview)}%` }} />
            </div>
            <h3>Этапы</h3>
            {preview.stages?.length ? (
              <ul className="gl-stage-list">
                {preview.stages.slice(0, 6).map((stage) => {
                  const m = stageMetrics(state, preview, stage);
                  return (
                    <li key={stage.id} className={m.complete ? 'is-done' : ''}>
                      <span className="gl-dot" aria-hidden="true" />
                      <span className="gl-stage-name">{stage.name}</span>
                      <b>{m.complete ? 'готово' : `${Math.round(m.progress)}%`}</b>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="gl-side-empty">Этапов пока нет.</p>
            )}
            <h3>Ближайшие задачи</h3>
            {goalUpcomingTasks(state, preview).length ? (
              <ul className="gl-task-list">
                {goalUpcomingTasks(state, preview).map((task) => (
                  <li key={task.id}>
                    <span>{task.name}</span>
                    {task.dueAt && (
                      <small>
                        {new Date(task.dueAt).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </small>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="gl-side-empty">Открытых задач нет.</p>
            )}
            <div className="gl-side-reward">
              🏆 Награда за цель: <b>{preview.reward} XP</b>
              {preview.rewarded ? ' · получена' : ''}
            </div>
            <button
              className="primary-button gl-plan"
              onClick={() => onSelect(preview.id)}
            >
              Открыть план цели
              <Icon name="arrow" size={16} />
            </button>
          </aside>
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
