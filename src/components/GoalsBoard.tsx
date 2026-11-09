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
import { TickTickInboxContent } from './TickTickInboxDialog';
import Icon from './Icon';
import GameArt from './GameArt';
import ProjectArt from './ProjectArt';
import GoalWorkspace from './GoalWorkspace';
import QuestWizard from './QuestWizard';
import { goalProgressValue } from '../goalWorkspace';
import {
  deadlineLabel,
  goalCardPace,
  goalDaysLeft,
  goalNextStep,
  goalSortNames,
  goalsSummary,
  isGoalDone,
  shortDate,
  sortGoals,
} from '../goalsOverview';
import type { GoalSort } from '../goalsOverview';
import {
  MAX_MONTHLY_FOCUS,
  monthlyFocusGoals,
  toggleMonthlyFocus,
} from '../monthlyFocus';
import './GoalsOverview.css';
type Editor =
  | { kind: 'goal' }
  | { kind: 'stage'; stage?: GoalStage }
  | { kind: 'task'; task?: Quest; stageId?: string }
  | { kind: 'transfer'; task?: Quest }
  | { kind: 'inbox' };
function TileIcon({
  kind,
}: {
  kind: 'target' | 'pause' | 'check' | 'list' | 'checkBadge' | 'alert';
}) {
  const paths = {
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" /></>,
    pause: <><rect x="7" y="5" width="4" height="14" rx="1.5" /><rect x="14" y="5" width="4" height="14" rx="1.5" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9" /></>,
    list: <><circle cx="5" cy="7" r="1.3" fill="currentColor" stroke="none" /><path d="M9 7h11" /><circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none" /><path d="M9 12h11" /><circle cx="5" cy="17" r="1.3" fill="currentColor" stroke="none" /><path d="M9 17h11" /></>,
    checkBadge: <><rect x="4" y="4" width="16" height="16" rx="5" /><path d="M8 12.5l2.5 2.5L16 9" /></>,
    alert: <><path d="M12 4l9 16H3z" /><path d="M12 10v4" /><circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" /></>,
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
  backLabel = '← Все проекты',
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
  const [taskDraft, setTaskDraft] = useState<Partial<Quest> | null>(null);
  const monthNow = new Date();
  const currentMonthlyFocus = monthlyFocusGoals(state, monthNow);
  const monthlyFocusLimitReached =
    currentMonthlyFocus.length >= MAX_MONTHLY_FOCUS;
  const monthlyFocusLimitMessage = `В этом месяце уже выбрано ${MAX_MONTHLY_FOCUS} из ${MAX_MONTHLY_FOCUS} главных проектов. Сначала уберите один из них.`;
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
    onChange((s) => ({ ...s, mainGoalId: id })); onNotify('Главный проект выбран');
  }
  function toggleGoalMonthlyFocus(id: string) {
    const isMonthlyFocus = currentMonthlyFocus.some((goal) => goal.id === id);
    const shouldAdd = !isMonthlyFocus;
    try {
      if (shouldAdd && monthlyFocusLimitReached) {
        throw new Error(monthlyFocusLimitMessage);
      }
      toggleMonthlyFocus(state, id, monthNow);
    } catch (e) {
      onNotify(
        e instanceof Error ? e.message : 'Не удалось изменить главные проекты месяца.',
      );
      return;
    }
    onChange((latest) => {
      const latestFocus = monthlyFocusGoals(latest, monthNow);
      const latestSelected = latestFocus.some((goal) => goal.id === id);
      if (
        !latest.goals.some((goal) => goal.id === id) ||
        (shouldAdd && (latestSelected || latestFocus.length >= MAX_MONTHLY_FOCUS)) ||
        (!shouldAdd && !latestSelected)
      ) {
        return latest;
      }
      return toggleMonthlyFocus(latest, id, monthNow);
    });
    onNotify(
      shouldAdd
        ? 'Проект выбран главным проектом месяца.'
        : 'Проект убран из главных проектов месяца.',
    );
  }
  function togglePause(g: Goal) {
    const next = !g.paused;
    onChange((s) => saveGoal(s, { ...g, paused: next }));
    onNotify(next ? 'Проект поставлен на паузу.' : 'Проект возобновлён.');
  }
  const monthlyFocusIds = new Set(currentMonthlyFocus.map((g) => g.id));
  const visibleGoals = sortGoals(
    state,
    state.goals.filter(
      (g) =>
        // Главные проекты месяца уже показаны отдельным блоком выше списка,
        // поэтому здесь не дублируются — независимо от текущей вкладки.
        !monthlyFocusIds.has(g.id) &&
        (sphereFilter === 'all' || g.sphere === sphereFilter) &&
        (goalFilter === 'all' ||
          (goalFilter === 'paused'
            ? g.paused && !isGoalDone(g)
            : goalFilter === 'done'
              ? isGoalDone(g)
              : !isGoalDone(g) && !g.paused)),
    ),
    sort,
  );
  const usedSpheres = spheres.filter((sp) =>
    state.goals.some((g) => g.sphere === sp.id),
  );
  const summary = goalsSummary(state, state.goals);
  const progress = (g: Goal) => Math.round(goalProgressValue(state, g));
  const listHeading =
    goalFilter === 'all'
      ? 'Все проекты'
      : goalFilter === 'paused'
        ? 'Проекты на паузе'
        : goalFilter === 'done'
          ? 'Завершённые проекты'
          : 'Активные проекты';
  function renderGoalCard(g: Goal) {
    const sphere = spheres.find((s) => s.id === g.sphere)!;
    const days = goalDaysLeft(g);
    const done = isGoalDone(g);
    const late = !done && !g.paused && days !== undefined && days < 0;
    const next = goalNextStep(state, g);
    const isMain = mainGoal?.id === g.id;
    const isMonthlyFocus = monthlyFocusIds.has(g.id);
    const pace = goalCardPace(state, g);
    return (
      <section
        className={`gl-card ${isMain ? 'is-main' : ''}`}
        key={g.id}
        style={{ '--gl-color': sphere.color } as CSSProperties}
      >
        <div className="gl-head">
          <span className="sphere-icon gl-icon">
            {g.image ? (
              <ProjectArt name={g.name} sphere={g.sphere} image={g.image} />
            ) : (
              <GameArt kind={g.sphere === 'english' ? 'target' : g.sphere} />
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
          </div>
          <div className={`gl-deadline ${late ? 'is-late' : ''}`}>
            {!done && g.startsAt ? (
              <>
                <small>{g.dueAt ? 'Старт → дедлайн' : 'Старт'}</small>
                <b>
                  {shortDate(g.startsAt)}
                  {g.dueAt ? ` → ${shortDate(g.dueAt)}` : ''}
                </b>
                <span>{g.dueAt ? deadlineLabel(g) : 'Без дедлайна'}</span>
              </>
            ) : (
              <>
                <small>Срок</small>
                <b>
                  {g.dueAt
                    ? new Date(g.dueAt).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                      })
                    : 'Без срока'}
                </b>
                {(g.dueAt || done) && <span>{deadlineLabel(g)}</span>}
              </>
            )}
          </div>
        </div>
        <div className="gl-tags">
          <button
            type="button"
            className={`gl-tag gl-tag-sphere ${sphereFilter === g.sphere ? 'is-active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setSphereFilter(sphereFilter === g.sphere ? 'all' : g.sphere);
            }}
          >
            {sphere.name}
          </button>
          <span
            className={`gl-tag ${late ? 'is-late' : ''} ${g.paused ? 'is-paused' : ''}`}
          >
            {goalStatus(state, g)}
          </span>
          {isMain && <span className="gl-tag is-main">★ Главная</span>}
          {isMonthlyFocus && (
            <span className="gl-tag is-monthly-focus">
              ★ Главный проект месяца
            </span>
          )}
        </div>
        <div className="gl-card-bottom">
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
              aria-label={`Прогресс проекта «${g.name}»`}
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
              ) : done ? (
                'Проект завершён'
              ) : (
                'Добавьте первый шаг в плане проекта'
              )}
            </p>
            <span className={`gl-pace gl-pace-${pace.tone}`}>{pace.text}</span>
          </div>
          <details className="goal-controls">
            <summary>Прогресс и сроки</summary>{' '}
            <button
              className="text-button main-goal-button"
              aria-pressed={isMain}
              onClick={() => main(g.id)}
            >
              {isMain ? '★ Главный проект' : '☆ Сделать главным'}
            </button>
            <button
              className="text-button main-goal-button"
              aria-pressed={isMonthlyFocus}
              disabled={!isMonthlyFocus && monthlyFocusLimitReached}
              title={
                !isMonthlyFocus && monthlyFocusLimitReached
                  ? monthlyFocusLimitMessage
                  : undefined
              }
              onClick={() => toggleGoalMonthlyFocus(g.id)}
            >
              {isMonthlyFocus
                ? 'Убрать из главных проектов месяца'
                : 'Сделать главным проектом месяца'}
            </button>
            {!isMonthlyFocus && monthlyFocusLimitReached && (
              <small className="gl-monthly-focus-limit">
                {monthlyFocusLimitMessage}
              </small>
            )}
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
                        `Проект завершён! +${next.xp - state.xp} XP`,
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
          <div className="gl-card-actions">
            {!done && (
              <button
                type="button"
                className={`text-button gl-pause-toggle${g.paused ? ' is-paused' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  togglePause(g);
                }}
              >
                {g.paused ? '▶ Возобновить' : 'Ⅱ Пауза'}
              </button>
            )}
            <button
              className="primary-button gl-plan"
              onClick={() => onSelect(g.id)}
            >
              {done
                ? g.projectReview
                  ? 'Открыть практику'
                  : 'Завершить проект'
                : 'Открыть проект'}
              <Icon name="arrow" size={16} />
            </button>
          </div>
        </div>
      </section>
    );
  }
  return (
    <>
      <div className="page-toolbar">
        <div>
          <p className="muted">
            {goal
              ? 'Большой проект становится понятными шагами.'
              : 'Сферы жизни → проекты → этапы → задачи.'}
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
          <Icon name="plus" size={17} /> Новый проект
        </button>
      </div>
      {selectedId && !goal && <div className="panel"><h2>Проект не найден</h2><p>Проверьте ссылку или выберите проект из своей игры.</p><button className="text-button" onClick={() => onSelect(null)}>Все проекты →</button></div>}
      {!goal && (
        <>
          <div className="gl-summary">
            <div className="gl-tile">
              <i className="gl-ico is-blue"><TileIcon kind="target" /></i>
              <div>
                <b>{summary.active}</b>
                <span>Активные проекты</span>
              </div>
            </div>
            <div className="gl-tile">
              <i className="gl-ico is-orange"><TileIcon kind="pause" /></i>
              <div>
                <b>{summary.paused}</b>
                <span>Проекты на паузе</span>
              </div>
            </div>
            <div className="gl-tile">
              <i className="gl-ico is-purple"><TileIcon kind="check" /></i>
              <div>
                <b>{summary.completed}</b>
                <span>Завершённые проекты</span>
              </div>
            </div>
            <div className="gl-tile">
              <i className="gl-ico is-green"><TileIcon kind="list" /></i>
              <div>
                <b>{summary.activeOpenTasks}</b>
                <span>Задачи в активных проектах</span>
              </div>
            </div>
            <div className="gl-tile">
              <i className="gl-ico is-gold"><TileIcon kind="checkBadge" /></i>
              <div>
                <b>{summary.completedTasksTotal}</b>
                <span>Всего завершено задач</span>
              </div>
            </div>
            <div className="gl-tile">
              <i className="gl-ico is-red"><TileIcon kind="alert" /></i>
              <div>
                <b>{summary.overdueTasks}</b>
                <span>Просроченные задачи</span>
              </div>
            </div>
          </div>
          <div className="gl-filters">
            <div className="tabs goal-tabs">
              {[
                ['all', 'Все'],
                ['active', 'Активные'],
                ['paused', 'На паузе'],
                ['done', 'Завершённые'],
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
              <div className="gl-chips" role="group" aria-label="Сфера проекта">
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
      {!goal && state.goals.length > 0 && (
        <div className="gl-featured">
          <div className="gl-featured-head">
            <div>
              <h3>Главные проекты месяца</h3>
              <p className="gl-section-sub">
                До трёх проектов в фокусе — им отдаётся приоритет среди
                активных.
              </p>
            </div>
            <span className="gl-featured-count">
              {currentMonthlyFocus.length} из {MAX_MONTHLY_FOCUS}
            </span>
          </div>
          <div className="gl-featured-grid">
            {currentMonthlyFocus.map((g) => renderGoalCard(g))}
            {Array.from({
              length: MAX_MONTHLY_FOCUS - currentMonthlyFocus.length,
            }).map((_, i) => (
              <div className="gl-card gl-add-slot" key={`gl-add-slot-${i}`}>
                <span className="gl-add-slot-icon" aria-hidden="true">
                  ＋
                </span>
                <p>
                  Откройте проект ниже и отметьте «Сделать главным проектом
                  месяца»
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      {!goal ? (
        <div className="gl-list">
          <div className="gl-list-head">
            <h3 className="gl-section-heading">{listHeading}</h3>
            <p className="gl-section-sub">
              Нажмите на бейдж сферы в карточке, чтобы отфильтровать список.
            </p>
          </div>
          {visibleGoals.map((g) => renderGoalCard(g))}
          {visibleGoals.length === 0 && (
            <div className="panel empty">
              <span>🎯</span>
              <h3>
                {goalFilter === 'done'
                  ? 'Твои победы ещё впереди'
                  : goalFilter === 'paused'
                    ? 'Нет проектов на паузе'
                    : 'Начни с того, что важно'}
              </h3>
              <p>
                {goalFilter === 'paused'
                  ? 'Поставьте проект на паузу в его карточке, если сейчас не время им заниматься.'
                  : 'Поставь проект, выбери срок и добавь первый реальный шаг.'}
              </p>
            </div>
          )}
        </div>
      ) : (
        <GoalWorkspace ownerId={ownerId} key={`${goal.id}:${stageId ?? 'goal'}`} state={state} goal={goal} stageId={stageId} onChange={onChange}
          onEditGoal={() => setEditor({ kind: 'goal' })} onEditStage={stage => setEditor({ kind: 'stage', stage })}
          onAddTask={stageId => setTaskDraft({ sphere: goal.sphere, goalId: goal.id, stageId })} onEditTask={task => setEditor({ kind: 'task', task })}
          onTransfer={task => setEditor({ kind: 'transfer', task })} onInbox={() => setEditor({ kind: 'inbox' })} onNotify={onNotify} onSelect={onSelect} onSphere={onSphere} />
      )}
      <dialog
        className={editor?.kind === 'inbox' ? 'ticktick-inbox-dialog' : undefined}
        aria-label={
          editor?.kind === 'inbox'
            ? `Разобрать входящие: ${spheres.find((s) => s.id === goal?.sphere)?.name ?? ''}`
            : editor?.kind === 'stage'
            ? 'Настройка этапа'
            : editor?.kind === 'task'
              ? 'Настройка задачи'
              : editor?.kind === 'transfer'
                ? 'Подключение TickTick'
                : 'Настройка проекта'
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
                onNotify('Проект обновлён');
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
              onInbox={() => setEditor({ kind: 'inbox' })}
            />
          )}
          {goal && editor?.kind === 'inbox' && <TickTickInboxContent key={`${goal.id}:${stageId ?? ''}`} state={state} onChange={onChange} scope={{ sphereId: goal.sphere, goalId: goal.id, stageId }} />}
        </div>
      </dialog>
      {taskDraft && (
        <QuestWizard
          initial={taskDraft}
          taskLabels={state.taskLabels ?? []}
          onClose={() => setTaskDraft(null)}
          onQuest={(input, labels) => {
            onChange((current) => saveTask(
              { ...current, taskLabels: labels ?? current.taskLabels },
              input,
            ));
            setTaskDraft(null);
            onNotify('Задача добавлена в план');
          }}
          onHabit={() => undefined}
        />
      )}
    </>
  );
}
