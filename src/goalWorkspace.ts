import type { GameState, Goal, GoalStage, Quest, Event } from './game.ts';
import { planningDay, planningMetrics } from './planningData.ts';
import { dependencyBlockMessage } from './taskDependencies.ts';

export function taskFraction(task: Quest) {
  return task.done
    ? 1
    : task.targetValue
      ? Math.max(0, Math.min(1, (task.currentValue ?? 0) / task.targetValue))
      : 0;
}
function weightedProgress(tasks: Quest[]) {
  const weight = tasks.reduce((sum, q) => sum + (q.weight ?? 1), 0);
  return weight
    ? (tasks.reduce((sum, q) => sum + taskFraction(q) * (q.weight ?? 1), 0) /
        weight) *
        100
    : 0;
}
export function goalProgressValue(
  state: Pick<GameState, 'quests'>,
  goal: Goal,
) {
  const tasks = state.quests.filter(
    (q) => q.goalId === goal.id && q.required !== false,
  );
  if (goal.progressMode === 'tasks' && tasks.length) {
    const stages = goal.stages ?? [];
    if (!stages.length) return weightedProgress(tasks);
    // Прогресс цели с этапами считается по этапам, а не по сумме всех задач:
    // каждый этап даёт свою долю (100%, если завершён, иначе прогресс его
    // собственных задач — 0%, если задач в нём ещё нет). Так этап, заведённый
    // заранее для планирования будущего без задач, не даёт цели показать
    // 100%, пока сам этап не завершён.
    const parts = stages.map((stage) => {
      const metrics = stageMetrics(state, goal, stage);
      return metrics.complete ? 100 : metrics.progress;
    });
    const unassigned = tasks.filter(
      (q) => !q.stageId || !stages.some((s) => s.id === q.stageId),
    );
    if (unassigned.length) parts.push(weightedProgress(unassigned));
    return parts.reduce((a, b) => a + b, 0) / parts.length;
  }
  return Math.max(0, Math.min(100, (goal.current / goal.target) * 100));
}
export function stageMetrics(
  state: Pick<GameState, 'quests'>,
  goal: Goal,
  stage: GoalStage,
) {
  const tasks = state.quests.filter(
    (q) => q.goalId === goal.id && q.stageId === stage.id,
  );
  const required = tasks.filter((q) => q.required !== false);
  const complete =
    stage.completionMode === 'manual'
      ? stage.status === 'completed'
      : required.length > 0
        ? required.every((q) => q.done)
        : stage.status === 'completed';
  return {
    tasks,
    required,
    complete,
    progress: complete ? 100 : weightedProgress(required),
    done: tasks.filter((q) => q.done).length,
    total: tasks.length,
  };
}
export function stageAccess(state: GameState, goal: Goal, stage: GoalStage) {
  if (stage.status === 'locked')
    return 'Этот этап заблокирован в настройках проекта.';
  if (stage.prerequisiteId) {
    const prior = goal.stages?.find((s) => s.id === stage.prerequisiteId);
    if (!prior)
      return 'Не найден обязательный предыдущий этап. Проверьте настройки.';
    if (!stageMetrics(state, goal, prior).complete)
      return `Сначала завершите этап «${prior.name}».`;
  }
  return '';
}
export function activeGoalStage(
  state: GameState,
  goal: Goal,
  now = new Date(),
) {
  const available = (goal.stages ?? []).filter(
    (s) =>
      !stageAccess(state, goal, s) &&
      !stageMetrics(state, goal, s).complete &&
      s.status !== 'paused' &&
      (!s.startsAt || Date.parse(s.startsAt) <= now.getTime()),
  );
  return available.find((s) => s.status === 'active') ?? available[0];
}
export function stageState(
  state: GameState,
  goal: Goal,
  stage: GoalStage,
  now = new Date(),
) {
  if (stageAccess(state, goal, stage)) return 'locked';
  if (stageMetrics(state, goal, stage).complete) return 'completed';
  if (stage.status === 'paused') return 'paused';
  return activeGoalStage(state, goal, now)?.id === stage.id
    ? 'active'
    : 'planned';
}
export const stageLabels = {
  active: 'В процессе',
  planned: 'Запланирован',
  paused: 'Приостановлен',
  locked: 'Заблокирован',
  completed: 'Завершён',
};
export function stageDays(
  stage: { startsAt?: string; dueAt?: string; completedAt?: string },
  now = new Date(),
) {
  const end = stage.completedAt ? new Date(stage.completedAt) : now;
  const elapsed = stage.startsAt
    ? Math.max(
        0,
        Math.floor((end.getTime() - Date.parse(stage.startsAt)) / 86400000),
      )
    : null;
  const remaining = stage.dueAt
    ? Math.ceil((Date.parse(stage.dueAt) - end.getTime()) / 86400000)
    : null;
  const span =
    stage.startsAt && stage.dueAt
      ? Date.parse(stage.dueAt) - Date.parse(stage.startsAt)
      : 0;
  return {
    elapsed,
    remaining,
    progress:
      span > 0
        ? Math.max(
            0,
            Math.min(
              100,
              ((end.getTime() - Date.parse(stage.startsAt!)) / span) * 100,
            ),
          )
        : null,
  };
}
export function nextGoalTask(state: GameState, goal: Goal, now = new Date()) {
  const candidates = state.quests.filter((q) => {
    if (
      q.goalId !== goal.id ||
      q.done ||
      q.rewardClaimed ||
      (q.startsAt && Date.parse(q.startsAt) > now.getTime())
    )
      return false;
    const stage = goal.stages?.find((s) => s.id === q.stageId);
    return (
      !stage ||
      (!stageAccess(state, goal, stage) &&
        stage.status !== 'paused' &&
        (!stage.startsAt || Date.parse(stage.startsAt) <= now.getTime()))
    );
  });
  const rank = (q: Quest) => {
    const stage = goal.stages?.find((s) => s.id === q.stageId);
    return q.dueAt &&
      Date.parse(q.dueAt) < now.getTime() &&
      stage &&
      stageState(state, goal, stage, now) === 'active'
      ? 0
      : q.dueAt
        ? 1
        : q.required !== false
          ? 2
          : 3;
  };
  return candidates.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.dueAt ? Date.parse(a.dueAt) : Infinity) -
        (b.dueAt ? Date.parse(b.dueAt) : Infinity) ||
      (goal.stages?.findIndex((s) => s.id === a.stageId) ?? -1) -
        (goal.stages?.findIndex((s) => s.id === b.stageId) ?? -1),
  )[0];
}
export function goalHistory(
  state: GameState,
  goal: Goal,
  stageId?: string,
): Event[] {
  const tasks = state.quests.filter(
    (q) => q.goalId === goal.id && (!stageId || q.stageId === stageId),
  );
  const ids = new Set(tasks.map((q) => q.id));
  const legacyRewardUnambiguous =
    state.goals.filter((g) => g.name === goal.name && g.sphere === goal.sphere)
      .length === 1;
  const events = state.events.filter((e) => {
    if (e.goalId)
      return e.goalId === goal.id && (!stageId || e.stageId === stageId);
    if (e.sourceId && ids.has(e.sourceId)) return true;
    if (stageId || e.kind !== 'goal') return false;
    return (
      e.sourceId === goal.id ||
      (!e.sourceId &&
        legacyRewardUnambiguous &&
        e.sphere === goal.sphere &&
        e.title === `Цель: ${goal.name}`)
    );
  });
  const stage = goal.stages?.find((s) => s.id === stageId);
  const created = stageId ? stage?.createdAt : goal.created;
  return [
    ...events,
    ...(created
      ? [
          {
            id: `created:${stageId ?? goal.id}`,
            sphere: goal.sphere,
            title: stageId ? 'Этап создан' : 'Проект создан',
            xp: 0,
            date: created,
            kind: 'planning' as const,
            goalId: goal.id,
            stageId,
          },
        ]
      : []),
  ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}
export type GoalPaceStatus = 'ahead' | 'on-track' | 'behind' | 'unknown';
export const goalPaceLabels: Record<GoalPaceStatus, string> = {
  ahead: 'Опережение графика',
  'on-track': 'По графику',
  behind: 'Отставание от графика',
  unknown: 'Недостаточно данных',
};
/**
 * Сравнивает % прогресса проекта с % прошедшего от его срока времени —
 * показывает, идёт ли проект с опережением, по графику или с отставанием.
 * Требует срок начала и окончания; без них (или без завершённого прогресса
 * по времени) статус не определён. Работает для любой сферы и режима
 * прогресса (задачи или числовой результат) — не зависит от конкретных
 * этапов или задач.
 */
export function goalPaceStatus(
  state: Pick<GameState, 'quests'>,
  goal: Goal,
  now = new Date(),
): { status: GoalPaceStatus; timeProgress: number | null; progress: number } {
  const progress = goalProgressValue(state, goal);
  const start = goal.startsAt ?? goal.created;
  if (!start || !goal.dueAt)
    return { status: 'unknown', timeProgress: null, progress };
  const startMs = Date.parse(start);
  const endMs = Date.parse(goal.dueAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs)
    return { status: 'unknown', timeProgress: null, progress };
  const timeProgress = Math.max(
    0,
    Math.min(100, ((now.getTime() - startMs) / (endMs - startMs)) * 100),
  );
  const delta = progress - timeProgress;
  const status: GoalPaceStatus =
    progress >= 100
      ? 'on-track'
      : delta >= 8
        ? 'ahead'
        : delta <= -8
          ? 'behind'
          : 'on-track';
  return { status, timeProgress, progress };
}
export function goalActivityStreak(
  state: GameState,
  goal: Goal,
  now = new Date(),
) {
  const days = new Set(
    goalHistory(state, goal)
      .filter((e) => e.kind === 'quest')
      .map((e) => new Date(e.date).toLocaleDateString('en-CA')),
  );
  const d = new Date(now);
  let count = 0;
  if (!days.has(d.toLocaleDateString('en-CA'))) d.setDate(d.getDate() - 1);
  while (days.has(d.toLocaleDateString('en-CA'))) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

// ---------------------------------------------------------------------------
// «Контроль проектов» (ТЗ «Этап 3», раздел 4). Только вычисляемые значения —
// ничего не сохраняется в GameState. Переиспользует существующие данные:
// goalHistory() (последняя активность), nextGoalTask()/stageAccess() (следующий
// доступный шаг), planningMetrics() (переносы), dependencyBlockMessage() (причина
// блокировки следующей задачи).
// ---------------------------------------------------------------------------
export type ProjectStatus =
  | 'advancing'
  | 'needsAttention'
  | 'noNextStep'
  | 'hasOverdueStages'
  | 'noConfirmedActivity';
export const projectStatusLabels: Record<ProjectStatus, string> = {
  advancing: 'Продвигается',
  needsAttention: 'Требует внимания',
  noNextStep: 'Нет доступного следующего шага',
  hasOverdueStages: 'Есть просроченные этапы',
  noConfirmedActivity: 'Нет подтверждённой активности',
};
/** Дней без подтверждённой активности/прогресса, после которых проект считается «нет активности». */
export const PROJECT_NO_ACTIVITY_DAYS = 14;
export type ProjectControl = {
  status: ProjectStatus;
  /** ISO-дата последнего события проекта (задача/перенос/время/создание) — goalHistory()[0]. */
  lastActivity?: string;
  daysSinceActivity?: number;
  /** Дней с последнего ЗАВЕРШЕНИЯ задачи проекта (прогресса), а не любой активности. */
  daysWithoutProgress?: number;
  openTasks: number;
  doneTasks: number;
  overdueTasks: number;
  /** Сумма достоверных переносов (planningMetrics) по всем задачам проекта. */
  confirmedPostponements: number;
  /** Ближайший срок — из незавершённых этапов, открытых задач или самого проекта. */
  nearestDeadline?: string;
  nextTask?: Quest;
  /** Причина блокировки nextTask зависимостями, если задача найдена, но заблокирована. */
  nextTaskBlockedReason?: string;
};
export function projectControl(
  state: GameState,
  goal: Goal,
  now = new Date(),
  metrics = planningMetrics(state),
): ProjectControl {
  const today = planningDay(now.toISOString())!;
  const tasks = state.quests.filter((q) => q.goalId === goal.id);
  const open = tasks.filter((q) => !q.done && !q.planning?.archivedAt && !q.wontDo);
  const doneTasks = tasks.filter((q) => q.done).length;
  const overdueTasks = open.filter((q) => {
    const d = planningDay(q.dueAt ?? q.startsAt);
    return d && d < today;
  }).length;
  const confirmedPostponements = tasks.reduce((sum, q) => sum + (metrics.get(q.id)?.moves ?? 0), 0);
  const history = goalHistory(state, goal);
  const lastActivity = history[0]?.date;
  const daysSinceActivity = lastActivity ? Math.floor((now.getTime() - Date.parse(lastActivity)) / 86400000) : undefined;
  const lastProgress = history.find((e) => e.kind === 'quest')?.date;
  const daysWithoutProgress = lastProgress ? Math.floor((now.getTime() - Date.parse(lastProgress)) / 86400000) : undefined;
  const openStages = (goal.stages ?? []).filter((s) => !stageMetrics(state, goal, s).complete);
  const nearestDeadline = [goal.dueAt, ...openStages.map((s) => s.dueAt), ...open.map((q) => q.dueAt)]
    .filter((v): v is string => !!v)
    .sort()[0];
  const nextTask = nextGoalTask(state, goal, now);
  const nextTaskBlockedReason = nextTask ? dependencyBlockMessage(state.quests, nextTask) : undefined;
  const hasOverdueStages = openStages.some((s) => s.dueAt && Date.parse(s.dueAt) < now.getTime());
  const progress = goalProgressValue(state, goal);
  const status: ProjectStatus = hasOverdueStages
    ? 'hasOverdueStages'
    : !nextTask && progress < 100
      ? 'noNextStep'
      : daysSinceActivity === undefined || daysSinceActivity >= PROJECT_NO_ACTIVITY_DAYS
        ? 'noConfirmedActivity'
        : overdueTasks > 0 || confirmedPostponements > 0
          ? 'needsAttention'
          : 'advancing';
  return {
    status, lastActivity, daysSinceActivity, daysWithoutProgress,
    openTasks: open.length, doneTasks, overdueTasks, confirmedPostponements,
    nearestDeadline, nextTask, nextTaskBlockedReason,
  };
}
