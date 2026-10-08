import { validProjectImage } from './projectImage.ts';
import { dateKey, difficulties, syncGoalTasks } from './game.ts';
import {
  stageMetrics,
  stageAccess,
  goalProgressValue,
} from './goalWorkspace.ts';
import type { GameState, Goal, GoalStage, Quest } from './game.ts';
export type DurationUnit = 'hours' | 'days' | 'weeks' | 'months';
export type PlanScope = 'day' | 'week' | 'month' | 'year' | 'all';
export function localDateTime(date = new Date()) {
  return `${dateKey(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
export function toISO(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Укажи корректную дату.');
  return date.toISOString();
}
export function durationEnd(start: string, amount: number, unit: DurationUnit) {
  const date = new Date(start);
  if (
    Number.isNaN(date.getTime()) ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1200 ||
    !Number.isInteger(amount)
  )
    throw new Error('Длительность — целое число от 1 до 1200.');
  if (unit === 'hours') date.setTime(date.getTime() + amount * 3600000);
  else if (unit === 'days' || unit === 'weeks')
    date.setDate(date.getDate() + amount * (unit === 'weeks' ? 7 : 1));
  else {
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + amount);
    date.setDate(
      Math.min(
        day,
        new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(),
      ),
    );
  }
  return date.toISOString();
}
export function formatDate(value?: string) {
  return value
    ? new Date(value).toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Без срока';
}
export function durationLabel(startsAt?: string, dueAt?: string) {
  if (!startsAt || !dueAt) return 'Гибкий срок';
  const hours =
    (new Date(dueAt).getTime() - new Date(startsAt).getTime()) / 3600000;
  return hours < 24
    ? `${Number(hours.toFixed(1))} ч`
    : `${Math.ceil(hours / 24)} дн.`;
}
export function goalStatus(goal: Goal, now = new Date()) {
  return goal.current >= goal.target
    ? 'Достигнута'
    : goal.dueAt && new Date(goal.dueAt) < now
      ? 'Срок прошёл'
      : goal.startsAt && new Date(goal.startsAt) > now
        ? 'Запланирована'
        : 'В процессе';
}
function checkRange(
  startsAt?: string,
  dueAt?: string,
  parent?: { startsAt?: string; dueAt?: string },
) {
  for (const value of [startsAt, dueAt])
    if (value && Number.isNaN(new Date(value).getTime()))
      throw new Error('Проверь даты.');
  if (startsAt && dueAt && new Date(dueAt) <= new Date(startsAt))
    throw new Error('Срок окончания должен быть позже начала.');
  if (parent?.startsAt)
    for (const value of [startsAt, dueAt])
      if (value && new Date(value) < new Date(parent.startsAt))
        throw new Error('Задача или этап не могут начинаться до начала цели.');
  if (parent?.dueAt)
    for (const value of [startsAt, dueAt])
      if (value && new Date(value) > new Date(parent.dueAt))
        throw new Error(
          'Задача или этап выходят за срок цели. Сначала измени срок цели.',
        );
}
export function planEvent(
  state: GameState,
  goalId: string,
  title: string,
  stageId?: string,
): GameState {
  const goal = state.goals.find((g) => g.id === goalId);
  if (!goal) return state;
  return {
    ...state,
    events: [
      {
        id: crypto.randomUUID(),
        sphere: goal.sphere,
        title,
        xp: 0,
        date: new Date().toISOString(),
        kind: 'planning',
        goalId,
        stageId,
        goalProgress: goalProgressValue(state, goal),
      },
      ...state.events,
    ],
  };
}
export function saveGoal(
  state: GameState,
  input: Pick<Goal, 'name' | 'sphere' | 'target' | 'reward'> & Partial<Goal>,
): GameState {
  const existing = input.id
    ? state.goals.find((g) => g.id === input.id)
    : undefined;
  if (
    !input.name.trim() ||
    input.name.trim().length > 100 ||
    !validProjectImage(input.image) ||
    !state.spheres[input.sphere] ||
    !Number.isFinite(input.target) ||
    input.target < 1 ||
    input.target > 1000000 ||
    !Number.isFinite(input.reward) ||
    input.reward < 100 ||
    input.reward > 500
  )
    throw new Error('Проверь название, сферу, целевое значение и награду.');
  checkRange(input.startsAt, input.dueAt);
  if (existing) {
    for (const task of state.quests.filter((q) => q.goalId === existing.id))
      checkRange(task.startsAt, task.dueAt, input);
    for (const stage of existing.stages ?? [])
      checkRange(stage.startsAt, stage.dueAt, input);
    if (
      input.sphere !== existing.sphere &&
      state.quests.some((q) => q.goalId === existing.id)
    )
      throw new Error(
        'Для цели с задачами сфера сохраняется, чтобы учёт XP оставался верным.',
      );
  }
  const mode = input.progressMode ?? existing?.progressMode ?? 'manual';
  const goal: Goal = {
    ...(existing ?? {}),
    ...input,
    id: existing?.id ?? crypto.randomUUID(),
    name: input.name.trim(),
    created: existing?.created ?? dateKey(),
    current: existing?.current ?? 0,
    rewarded: existing?.rewarded ?? false,
    target: mode === 'tasks' ? 100 : input.target,
    progressMode: mode,
  };
  if (existing && mode === 'tasks' && existing.progressMode !== 'tasks') {
    goal.current = (existing.current / existing.target) * 100;
    goal.manualProgress = {
      current: existing.current,
      target: existing.target,
    };
  }
  if (existing && mode === 'manual' && existing.progressMode === 'tasks') {
    goal.current = existing.manualProgress?.current ?? 0;
    goal.target = input.target;
  }
  if (mode === 'manual' && goal.current > goal.target)
    throw new Error(
      'Целевое значение не может быть меньше уже достигнутого прогресса.',
    );
  let next: GameState = {
    ...state,
    goals: existing
      ? state.goals.map((g) => (g.id === goal.id ? goal : g))
      : [...state.goals, goal],
    mainGoalId: state.mainGoalId ?? goal.id,
  };
  if (mode === 'tasks') next = syncGoalTasks(next, goal.id);
  if (existing)
    next = planEvent(
      next,
      goal.id,
      existing.dueAt !== goal.dueAt || existing.startsAt !== goal.startsAt
        ? 'Изменён срок цели'
        : 'Изменены настройки цели',
    );
  return next;
}
export function saveStage(
  state: GameState,
  goalId: string,
  input: Omit<GoalStage, 'id'> & { id?: string },
): GameState {
  const goal = state.goals.find((g) => g.id === goalId);
  if (!goal || !input.name.trim() || input.name.length > 100)
    throw new Error('Укажи название этапа.');
  if (input.id && !goal.stages?.some((s) => s.id === input.id))
    throw new Error('Этап не найден в этой цели.');
  if (input.prerequisiteId) {
    const visited = new Set([input.id]);
    let id: string | undefined = input.prerequisiteId;
    while (id) {
      if (visited.has(id))
        throw new Error('Этапы не могут зависеть друг от друга по кругу.');
      visited.add(id);
      const prior = goal.stages?.find((s) => s.id === id);
      if (!prior) throw new Error('Предыдущий этап не найден в этой цели.');
      id = prior.prerequisiteId;
    }
  }
  checkRange(input.startsAt, input.dueAt, goal);
  if (input.id)
    for (const task of state.quests.filter(
      (q) => q.goalId === goalId && q.stageId === input.id,
    ))
      checkRange(task.startsAt, task.dueAt, {
        startsAt: input.startsAt ?? goal.startsAt,
        dueAt: input.dueAt ?? goal.dueAt,
      });
  const old = goal.stages?.find((s) => s.id === input.id);
  const stage = {
    ...old,
    ...input,
    createdAt: old ? old.createdAt : new Date().toISOString(),
    id: input.id ?? crypto.randomUUID(),
    name: input.name.trim(),
  };
  const next: GameState = {
    ...state,
    goals: state.goals.map((g) =>
      g.id === goalId
        ? {
            ...g,
            stages: input.id
              ? (g.stages ?? []).map((s) => (s.id === stage.id ? stage : s))
              : [...(g.stages ?? []), stage],
          }
        : g,
    ),
  };
  return planEvent(
    next,
    goalId,
    old
      ? old.dueAt !== stage.dueAt || old.startsAt !== stage.startsAt
        ? 'Изменён срок этапа'
        : `Изменён этап: ${stage.name}`
      : `Добавлен этап: ${stage.name}`,
    stage.id,
  );
}
export function removeStage(
  state: GameState,
  goalId: string,
  stageId: string,
): GameState {
  return {
    ...state,
    goals: state.goals.map((g) =>
      g.id === goalId
        ? { ...g, stages: (g.stages ?? []).filter((s) => s.id !== stageId) }
        : g,
    ),
    quests: state.quests.map((q) =>
      q.goalId === goalId && q.stageId === stageId
        ? { ...q, stageId: undefined }
        : q,
    ),
  };
}
export function saveTask(
  state: GameState,
  input: Pick<Quest, 'name' | 'sphere' | 'difficulty'> & Partial<Quest>,
): GameState {
  const existing = input.id
    ? state.quests.find((q) => q.id === input.id)
    : undefined;
  const goal = input.goalId
    ? state.goals.find((g) => g.id === input.goalId)
    : undefined;
  if (
    !input.name.trim() ||
    input.name.length > 100 ||
    !state.spheres[input.sphere] ||
    !(input.difficulty in difficulties)
  )
    throw new Error('Проверь название, сферу и сложность задачи.');
  if (input.goalId && !goal) throw new Error('Цель не найдена.');
  const stage = input.stageId
    ? goal?.stages?.find((s) => s.id === input.stageId)
    : undefined;
  if (input.stageId && !stage) throw new Error('Этап не найден.');
  if (
    input.weight !== undefined &&
    (!Number.isFinite(input.weight) || input.weight <= 0 || input.weight > 1000)
  )
    throw new Error('Вес задачи — от 0 до 1000, не включая 0.');
  checkRange(input.startsAt, input.dueAt, goal);
  if (stage)
    checkRange(input.startsAt, input.dueAt, {
      startsAt: stage.startsAt ?? goal?.startsAt,
      dueAt: stage.dueAt ?? goal?.dueAt,
    });
  if (
    input.estimateMinutes !== undefined &&
    (!Number.isFinite(input.estimateMinutes) ||
      input.estimateMinutes < 1 ||
      input.estimateMinutes > 43200)
  )
    throw new Error('Длительность задачи — от 1 минуты до 30 дней.');
  if (
    existing &&
    (existing.rewardLocked || (existing.currentValue ?? 0) > 0) &&
    (input.difficulty !== existing.difficulty ||
      (goal?.sphere ?? input.sphere) !== existing.sphere ||
      (input.rewardCoins ?? existing.rewardCoins) !== existing.rewardCoins ||
      (input.virtualRewardId ?? existing.virtualRewardId) !==
        existing.virtualRewardId)
  )
    throw new Error(
      'После начала прогресса награда, сложность и сфера зафиксированы.',
    );
  if (existing?.done)
    throw new Error(
      'Выполненная задача остаётся в истории; добавь новую для следующего действия.',
    );
  const task: Quest = {
    ...existing,
    ...input,
    createdAt: existing ? existing.createdAt : new Date().toISOString(),
    id: existing?.id ?? input.id ?? crypto.randomUUID(),
    name: input.name.trim(),
    sphere: goal?.sphere ?? input.sphere,
    done: false,
    xp: difficulties[input.difficulty as keyof typeof difficulties],
    difficulty: input.difficulty,
  };
  let next: GameState = {
    ...state,
    quests: existing
      ? state.quests.map((q) => (q.id === task.id ? task : q))
      : [...state.quests, task],
  };
  if (existing?.goalId && existing.goalId !== task.goalId)
    next = syncGoalTasks(next, existing.goalId);
  if (task.goalId) next = syncGoalTasks(next, task.goalId);
  if (task.goalId)
    next = planEvent(
      next,
      task.goalId,
      existing
        ? `Изменена задача: ${task.name}`
        : `Добавлена задача: ${task.name}`,
      task.stageId,
    );
  return next;
}
export function deleteGoal(state: GameState, id: string): GameState {
  return {
    ...state,
    hasCompletedGoal:
      state.hasCompletedGoal || state.goals.some((g) => g.rewarded),
    goals: state.goals.filter((g) => g.id !== id),
    mainGoalId: state.mainGoalId === id ? null : state.mainGoalId,
    quests: state.quests.map((q) =>
      q.goalId === id ? { ...q, goalId: undefined, stageId: undefined } : q,
    ),
  };
}
export function periodBounds(scope: PlanScope, anchor: string) {
  const start = new Date(`${anchor}T00:00:00`);
  if (Number.isNaN(start.getTime())) throw new Error('Выбери дату плана.');
  const end = new Date(start);
  if (scope === 'week') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 7);
  } else if (scope === 'month') {
    start.setDate(1);
    end.setTime(start.getTime());
    end.setMonth(end.getMonth() + 1);
  } else if (scope === 'year') {
    start.setMonth(0, 1);
    end.setTime(start.getTime());
    end.setFullYear(end.getFullYear() + 1);
  } else end.setDate(end.getDate() + 1);
  return { start, end };
}
export function periodItems(
  state: GameState,
  scope: PlanScope,
  anchor: string,
) {
  const { start, end } = periodBounds(scope, anchor);
  const overlaps = (item: { startsAt?: string; dueAt?: string }) => {
    if (scope === 'all') return true;
    if (!item.startsAt && !item.dueAt) return false;
    const from = new Date(item.startsAt ?? item.dueAt!),
      to = new Date(item.dueAt ?? item.startsAt!);
    return from < end && to >= start;
  };
  const goals = state.goals.filter(overlaps);
  const tasks = state.quests
    .filter(overlaps)
    .sort((a, b) =>
      (a.startsAt ?? a.dueAt ?? '9999').localeCompare(
        b.startsAt ?? b.dueAt ?? '9999',
      ),
    );
  return {
    goals,
    tasks,
    unscheduled: state.quests.filter((q) => !q.done && !q.startsAt && !q.dueAt),
    hours:
      tasks
        .filter((q) => !q.done)
        .reduce((sum, q) => sum + (q.estimateMinutes ?? 0), 0) / 60,
    start,
    end,
  };
}
export function isGoalTask(state: GameState, task: Quest): boolean {
  return Boolean(
    task.goalId && state.goals.some((goal) => goal.id === task.goalId),
  );
}
export function taskTransferText(task: Quest, state: GameState) {
  const goal = state.goals.find((g) => g.id === task.goalId);
  const stage = goal?.stages?.find((s) => s.id === task.stageId);
  return [
    task.name,
    goal ? `Цель: ${goal.name}` : '',
    stage ? `Этап: ${stage.name}` : '',
    task.startsAt ? `Начало: ${formatDate(task.startsAt)}` : '',
    task.dueAt ? `Срок: ${formatDate(task.dueAt)}` : '',
    task.estimateMinutes ? `Время: ${task.estimateMinutes} мин` : '',
    task.notes ?? '',
  ]
    .filter(Boolean)
    .join('\n');
}
export function planTransferText(tasks: Quest[], state: GameState) {
  return tasks
    .filter((q) => !q.done && isGoalTask(state, q))
    .map((q) => taskTransferText(q, state))
    .join('\n\n');
}
export function planCalendar(tasks: Quest[], state: GameState) {
  const escape = (s: string) =>
    s
      .replace(/\\/g, '\\\\')
      .replace(/\r?\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  const stamp = (s: string) =>
    new Date(s)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PLAY YOUR LIFE//Life plan//RU',
    'CALSCALE:GREGORIAN',
  ];
  for (const task of tasks.filter((q) => !q.done && (q.startsAt || q.dueAt))) {
    const start = task.startsAt ?? task.dueAt!;
    const end =
      task.dueAt && task.dueAt !== start
        ? task.dueAt
        : new Date(
            new Date(start).getTime() + (task.estimateMinutes ?? 30) * 60000,
          ).toISOString();
    lines.push(
      'BEGIN:VEVENT',
      `UID:${task.id}@play-your-life`,
      `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${escape(task.name)}`,
      `DESCRIPTION:${escape(taskTransferText(task, state))}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  // RFC 5545: fold lines at 75 UTF-8 octets, without splitting characters.
  const encoder = new TextEncoder();
  return (
    lines
      .map((line) => {
        let folded = '',
          column = 0;
        for (const char of line) {
          const bytes = encoder.encode(char).length;
          if (column + bytes > 75) {
            folded += '\r\n ';
            column = 1;
          }
          folded += char;
          column += bytes;
        }
        return folded;
      })
      .join('\r\n') + '\r\n'
  );
}

export function moveStage(
  state: GameState,
  goalId: string,
  stageId: string,
  position: number,
) {
  const goal = state.goals.find((g) => g.id === goalId);
  if (!goal) throw new Error('Цель не найдена.');
  const stages = [...(goal.stages ?? [])];
  const index = stages.findIndex((s) => s.id === stageId);
  if (
    index < 0 ||
    !Number.isInteger(position) ||
    position < 0 ||
    position >= stages.length
  )
    throw new Error('Проверь порядок этапов.');
  const [stage] = stages.splice(index, 1);
  stages.splice(position, 0, stage);
  return planEvent(
    {
      ...state,
      goals: state.goals.map((g) => (g.id === goalId ? { ...g, stages } : g)),
    },
    goalId,
    'Изменён порядок этапов',
    stageId,
  );
}
export function duplicateStage(
  state: GameState,
  goalId: string,
  stageId: string,
) {
  const goal = state.goals.find((g) => g.id === goalId),
    stage = goal?.stages?.find((s) => s.id === stageId);
  if (!goal || !stage) throw new Error('Этап не найден.');
  let next = saveStage(state, goalId, {
    ...stage,
    id: undefined,
    name: `${stage.name.slice(0, 90)} (копия)`,
    status: 'planned',
    createdAt: undefined,
    completedAt: undefined,
  });
  const newStage = next.goals.find((g) => g.id === goalId)!.stages!.at(-1)!;
  for (const task of state.quests.filter(
    (q) => q.goalId === goalId && q.stageId === stageId,
  ))
    next = saveTask(next, {
      ...task,
      id: undefined,
      stageId: newStage.id,
      done: false,
      createdAt: undefined,
      currentValue: 0,
      completedAt: undefined,
      rewardClaimed: false,
      rewardClaimedAt: undefined,
      rewardLocked: false,
      tickTickSharedAt: undefined,
    });
  return next;
}
export function finishStage(state: GameState, goalId: string, stageId: string) {
  const goal = state.goals.find((g) => g.id === goalId),
    stage = goal?.stages?.find((s) => s.id === stageId);
  if (!goal || !stage) throw new Error('Этап не найден.');
  const blocked = stageAccess(state, goal, stage);
  if (blocked) throw new Error(blocked);
  if (stage.status === 'completed') return state;
  if (
    stage.completionMode !== 'manual' &&
    !stageMetrics(state, goal, stage).complete
  )
    throw new Error('Сначала выполните все обязательные задачи этапа.');
  const next = saveStage(state, goalId, {
    ...stage,
    status: 'completed',
    completedAt: new Date().toISOString(),
  });
  return planEvent(next, goalId, `Завершён этап: ${stage.name}`, stageId);
}
