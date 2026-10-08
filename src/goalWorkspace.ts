import type { GameState, Goal, GoalStage, Quest, Event } from './game.ts';

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
  if (goal.progressMode === 'tasks' && tasks.length)
    return weightedProgress(tasks);
  return Math.max(0, Math.min(100, (goal.current / goal.target) * 100));
}
export function stageMetrics(state: GameState, goal: Goal, stage: GoalStage) {
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
    return 'Этот этап заблокирован в настройках цели.';
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
            title: stageId ? 'Этап создан' : 'Цель создана',
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
