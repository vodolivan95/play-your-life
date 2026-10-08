import { completeQuest, dateKey, syncGoalTasks } from "./game.ts";
import type {
  GameState,
  Goal,
  GoalHistoryEvent,
  GoalStage,
  Quest,
} from "./game.ts";
import { durationEnd, saveStage, saveTask } from "./planning.ts";
import { questCoins } from "./personalQuests.ts";
export const goalTasks = (state: GameState, goalId: string, stageId?: string) =>
  state.quests.filter(
    (q) =>
      q.goalId === goalId && (stageId === undefined || q.stageId === stageId),
  );
export function taskProgress(tasks: Quest[]) {
  const required = tasks.filter((q) => q.required !== false);
  const done = required.filter((q) => q.done).length;
  return {
    total: required.length,
    done,
    remaining: required.length - done,
    percent: required.length ? (done / required.length) * 100 : 0,
  };
}
export function orderedStages(goal: Goal) {
  return [...(goal.stages ?? [])].sort(
    (a, b) =>
      (a.order ?? (goal.stages ?? []).indexOf(a)) -
      (b.order ?? (goal.stages ?? []).indexOf(b)),
  );
}
export function stageLock(goal: Goal, stage: GoalStage) {
  const ordered = orderedStages(goal),
    i = ordered.findIndex((s) => s.id === stage.id);
  return stage.requiresPrevious &&
    i > 0 &&
    ordered[i - 1].status !== "completed"
    ? `Сначала завершите этап «${ordered[i - 1].name}».`
    : "";
}
export function calendarDay(value: string) {
  return value.length === 10 ? value : dateKey(new Date(value));
}
export function dayOrdinal(value: string) {
  const [y, m, d] = calendarDay(value).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}
export function timeline(stage: GoalStage, now = new Date()) {
  const today = dateKey(now),
    start = stage.startsAt ? calendarDay(stage.startsAt) : undefined,
    end = stage.dueAt ? calendarDay(stage.dueAt) : undefined;
  const elapsed = start
      ? Math.max(0, dayOrdinal(today) - dayOrdinal(start))
      : 0,
    total =
      start && end
        ? Math.max(0, dayOrdinal(end) - dayOrdinal(start))
        : undefined;
  return {
    today,
    start,
    end,
    elapsed,
    total,
    remaining: end
      ? Math.max(0, dayOrdinal(end) - dayOrdinal(today))
      : undefined,
    late:
      end && stage.status !== "completed"
        ? Math.max(0, dayOrdinal(today) - dayOrdinal(end))
        : 0,
    percent:
      total === undefined
        ? undefined
        : total === 0
          ? start! <= today
            ? 100
            : 0
          : Math.max(0, Math.min(100, (elapsed / total) * 100)),
  };
}
export function stageStatus(stage: GoalStage, now = new Date()) {
  const t = timeline(stage, now);
  return stage.status === "completed"
    ? "Завершён"
    : stage.status === "paused"
      ? "Приостановлен"
      : t.late
        ? "Просрочен"
        : t.start && t.start > t.today
          ? "Запланирован"
          : "В процессе";
}
export function monthCells(year: number, month: number) {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7,
    days = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) =>
    i >= offset && i < offset + days
      ? `${year}-${String(month + 1).padStart(2, "0")}-${String(i - offset + 1).padStart(2, "0")}`
      : null,
  );
}
export function addHistory(
  state: GameState,
  goalId: string,
  event: Omit<GoalHistoryEvent, "id" | "timestamp">,
): GameState {
  const now = new Date().toISOString();
  return {
    ...state,
    goals: state.goals.map((g) =>
      g.id === goalId
        ? {
            ...g,
            updatedAt: now,
            history: [
              ...(g.history ?? []),
              { ...event, id: crypto.randomUUID(), timestamp: now },
            ],
          }
        : g,
    ),
  };
}
export function editStage(
  state: GameState,
  goalId: string,
  input: Omit<GoalStage, "id"> & {
    id?: string;
  },
) {
  const goal = state.goals.find((g) => g.id === goalId)!;
  if (!goal) throw new Error("Цель не найдена.");
  const old = goal.stages?.find((s) => s.id === input.id);
  if (input.id && !old) throw new Error("Этап не найден.");
  for (const n of [input.rewardXP ?? 0, input.rewardCoins ?? 0])
    if (!Number.isInteger(n) || n < 0 || n > 500)
      throw new Error("Награда — целое число от 0 до 500.");
  if (
    old?.rewardClaimed &&
    ((input.rewardXP ?? 0) !== (old.rewardXP ?? 0) ||
      (input.rewardCoins ?? 0) !== (old.rewardCoins ?? 0))
  )
    throw new Error("Начисленную награду нельзя изменить.");
  const next = saveStage(state, goalId, { ...old, ...input });
  const stage =
    next.goals
      .find((g) => g.id === goalId)!
      .stages!.find((s) => s.id === input.id) ??
    next.goals.find((g) => g.id === goalId)!.stages!.at(-1)!;
  return addHistory(next, goalId, {
    stageId: stage.id,
    type: old ? "stage.updated" : "stage.created",
    title: old
      ? "Этап обновлён (название, сроки или настройки)"
      : "Этап создан",
  });
}
export function completeStage(
  state: GameState,
  goalId: string,
  stageId: string,
) {
  const g = state.goals.find((g) => g.id === goalId),
    s = g?.stages?.find((s) => s.id === stageId);
  if (!g || !s || s.status === "completed") return state;
  const locked = stageLock(g, s);
  if (locked) throw new Error(locked);
  const p = taskProgress(goalTasks(state, goalId, stageId));
  if ((s.completionMode ?? "all") === "all" && (!p.total || p.remaining))
    throw new Error("Выполните все обязательные задачи этапа.");
  const now = new Date().toISOString();
  let next: GameState = {
    ...state,
    goals: state.goals.map((goal) =>
      goal.id === goalId
        ? {
            ...goal,
            stages: goal.stages?.map((stage) =>
              stage.id === stageId
                ? {
                    ...stage,
                    status: "completed" as const,
                    completedAt: now,
                    rewardClaimed: true,
                  }
                : stage,
            ),
          }
        : goal,
    ),
  };
  if (!s.rewardClaimed) {
    next = {
      ...next,
      xp: next.xp + (s.rewardXP ?? 0),
      coins: next.coins + (s.rewardCoins ?? 0),
      spheres: {
        ...next.spheres,
        [g.sphere]: {
          ...next.spheres[g.sphere],
          xp: next.spheres[g.sphere].xp + (s.rewardXP ?? 0),
        },
      },
    };
  }
  const achievementId = `stage:${goalId}:${stageId}`;
  if (
    !s.rewardClaimed &&
    s.achievement?.trim() &&
    !(next.stageAchievements ?? []).some((a) => a.id === achievementId)
  )
    next = {
      ...next,
      stageAchievements: [
        ...(next.stageAchievements ?? []),
        {
          id: achievementId,
          goalId,
          stageId,
          name: s.achievement.trim(),
          rarity: s.rarity ?? "common",
          earnedAt: now,
        },
      ],
    };
  return addHistory(next, goalId, {
    stageId,
    type: "stage.completed",
    title: "Этап завершён и награда начислена",
    xp: s.rewardClaimed ? 0 : (s.rewardXP ?? 0),
    coins: s.rewardClaimed ? 0 : (s.rewardCoins ?? 0),
  });
}
export function finishGoalTask(state: GameState, id: string) {
  const q = state.quests.find((q) => q.id === id);
  if (!q || !q.goalId || q.done) return state;
  const g = state.goals.find((g) => g.id === q.goalId)!,
    stage = g.stages?.find((s) => s.id === q.stageId);
  if (stage) {
    const reason = stageLock(g, stage);
    if (reason) throw new Error(reason);
    if (stage.status === "paused" || stage.status === "completed")
      throw new Error("Этап приостановлен или завершён.");
  }
  let prepared = state;
  if (
    q.recurrence &&
    q.recurrence !== "none" &&
    !state.quests.some((t) => t.recurrenceParentId === q.id)
  ) {
    const base = q.dueAt ?? new Date().toISOString();
    const due = durationEnd(
      base,
      q.recurrence === "weekly" ? 7 : 1,
      q.recurrence === "monthly" ? "months" : "days",
    );
    if (!stage?.dueAt || new Date(due) <= new Date(stage.dueAt)) {
      prepared = saveTask(state, {
        ...q,
        id: undefined,
        name: q.name,
        startsAt: undefined,
        dueAt: due,
        recurrenceParentId: q.id,
        done: false,
        rewardClaimed: false,
        rewardClaimedAt: undefined,
        completedAt: undefined,
        currentValue: 0,
        rewardLocked: false,
      });
    }
  }
  let next = completeQuest(prepared, id);
  if (!next.quests.find((t) => t.id === id)?.done) return next;
  next = addHistory(next, g.id, {
    stageId: q.stageId,
    taskId: id,
    type: "task.completed",
    title: q.name,
    xp: q.xp,
    coins: questCoins(q),
  });
  if (
    stage?.autoComplete &&
    taskProgress(goalTasks(next, g.id, stage.id)).remaining === 0
  )
    next = completeStage(next, g.id, stage.id);
  return next;
}
export function undoGoalTask(state: GameState, id: string) {
  const q = state.quests.find((q) => q.id === id);
  if (!q?.done || !q.goalId) return state;
  const xp = q.xp,
    coins = questCoins(q);
  if (state.coins < coins || state.xp < xp || state.spheres[q.sphere].xp < xp)
    throw new Error(
      "Нельзя вернуть потраченную награду: недостаточно XP или монет.",
    );
  let next: GameState = {
    ...state,
    xp: state.xp - xp,
    coins: state.coins - coins,
    completed: Math.max(0, state.completed - 1),
    spheres: {
      ...state.spheres,
      [q.sphere]: {
        ...state.spheres[q.sphere],
        xp: state.spheres[q.sphere].xp - xp,
      },
    },
    quests: state.quests.map((t) =>
      t.id === id
        ? {
            ...t,
            done: false,
            rewardClaimed: false,
            completedAt: undefined,
            rewardClaimedAt: undefined,
            currentValue: 0,
          }
        : t,
    ),
    coinTransactions: state.coinTransactions?.filter(
      (t) => t.transactionId !== `quest:${id}`,
    ),
    rewardInventory: state.rewardInventory?.filter(
      (i) => i.id !== `quest:${id}`,
    ),
    events: state.events.filter(
      (e) => !(e.kind === "quest" && e.sourceId === id),
    ),
  };
  next = {
    ...next,
    goals: next.goals.map((g) =>
      g.id === q.goalId
        ? {
            ...g,
            stages: g.stages?.map((s) =>
              s.id === q.stageId && s.status === "completed"
                ? { ...s, status: "active" as const, completedAt: undefined }
                : s,
            ),
          }
        : g,
    ),
  };
  next = syncGoalTasks(next, q.goalId);
  return addHistory(next, q.goalId, {
    stageId: q.stageId,
    taskId: id,
    type: "task.undone",
    title: `Отменено: ${q.name}`,
    xp: -xp,
    coins: -coins,
  });
}
export function stageSeries(
  state: GameState,
  goal: Goal,
  stage: GoalStage,
  group: "day" | "week" | "month",
  from?: string,
  to?: string,
) {
  const recorded = new Set(
    (goal.history ?? [])
      .filter((e) => e.type === "task.completed")
      .map((e) => e.taskId),
  );
  const legacy = goalTasks(state, goal.id, stage.id)
    .filter((q) => q.completedAt && !recorded.has(q.id))
    .map((q) => ({
      id: "legacy:" + q.id,
      stageId: stage.id,
      taskId: q.id,
      type: "task.completed",
      title: q.name,
      timestamp: q.completedAt!,
      xp: q.xp,
      coins: questCoins(q),
    }));
  const events = [...(goal.history ?? []), ...legacy].filter(
    (e) =>
      e.stageId === stage.id &&
      (e.type === "task.completed" ||
        e.type === "task.undone" ||
        e.type === "stage.completed") &&
      (!from || calendarDay(e.timestamp) >= from) &&
      (!to || calendarDay(e.timestamp) <= to),
  );
  const totals = new Map<
    string,
    {
      count: number;
      xp: number;
      coins: number;
    }
  >();
  for (const e of events) {
    let key = calendarDay(e.timestamp);
    if (group === "month") key = key.slice(0, 7);
    if (group === "week") {
      const d = new Date(key + "T12:00:00");
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      key = dateKey(d);
    }
    const row = totals.get(key) ?? { count: 0, xp: 0, coins: 0 };
    row.count +=
      e.type === "task.completed" ? 1 : e.type === "task.undone" ? -1 : 0;
    row.xp += e.xp ?? 0;
    row.coins += e.coins ?? 0;
    totals.set(key, row);
  }
  return [...totals]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, ...value }));
}
export function planFact(
  state: GameState,
  goal: Goal,
  stage: GoalStage,
  now = new Date(),
) {
  const required = goalTasks(state, goal.id, stage.id).filter(
      (q) => q.required !== false,
    ),
    ids = new Set(required.map((q) => q.id));
  const events = (goal.history ?? [])
    .filter(
      (e) =>
        e.stageId === stage.id &&
        e.taskId &&
        ids.has(e.taskId) &&
        (e.type === "task.completed" || e.type === "task.undone"),
    )
    .map((e) => ({
      day: calendarDay(e.timestamp),
      id: e.taskId!,
      done: e.type === "task.completed",
      timestamp: e.timestamp,
    }));
  for (const q of required)
    if (q.completedAt && !events.some((e) => e.id === q.id))
      events.push({
        day: calendarDay(q.completedAt),
        id: q.id,
        done: true,
        timestamp: q.completedAt,
      });
  events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  if (!events.length) return [];
  const t = timeline(stage, now),
    start = t.start ?? events[0].day,
    end = t.end ?? t.today,
    a = dayOrdinal(start),
    b = dayOrdinal(end);
  if (b < a || !required.length) return [];
  const step = Math.max(1, Math.ceil((b - a) / 160)),
    done = new Set<string>(),
    points: { date: string; plan?: number; actual?: number }[] = [];
  let cursor = 0;
  for (let i = a; i <= b; i = Math.min(b, i + step)) {
    const date = new Date(i * 86400000).toISOString().slice(0, 10);
    while (cursor < events.length && events[cursor].day <= date) {
      const e = events[cursor++];
      if (e.done) done.add(e.id);
      else done.delete(e.id);
    }
    points.push({
      date,
      plan:
        t.start && t.end
          ? Math.min(100, ((i - a) / Math.max(1, b - a)) * 100)
          : undefined,
      actual: date <= t.today ? (done.size / required.length) * 100 : undefined,
    });
    if (i === b) break;
  }
  return points;
}

export function duplicateStage(
  state: GameState,
  goalId: string,
  stageId: string,
): GameState {
  const goal = state.goals.find((g) => g.id === goalId),
    source = goal?.stages?.find((s) => s.id === stageId);
  if (!goal || !source) throw new Error("Этап не найден.");
  let next = editStage(state, goalId, {
    ...source,
    id: undefined,
    completedAt: undefined,
    rewardClaimed: false,
    notesUpdatedAt: undefined,
    name: source.name + " — копия",
    order: goal.stages?.length ?? 0,
    status: "planned",
  });
  const copy = next.goals.find((g) => g.id === goalId)!.stages!.at(-1)!;
  for (const task of goalTasks(state, goalId, stageId)) {
    next = saveTask(next, {
      ...task,
      id: undefined,
      completedAt: undefined,
      rewardClaimedAt: undefined,
      recurrenceParentId: undefined,
      stageId: copy.id,
      done: false,
      rewardClaimed: false,
      rewardLocked: false,
      currentValue: 0,
    });
  }
  return next;
}

export function saveGoalTask(
  state: GameState,
  input: Parameters<typeof saveTask>[1],
) {
  const exists = state.quests.some((q) => q.id === input.id);
  const next = saveTask(state, input);
  const task = exists
    ? next.quests.find((q) => q.id === input.id)!
    : next.quests.find((q) => !state.quests.some((old) => old.id === q.id))!;
  return task.goalId
    ? addHistory(next, task.goalId, {
        stageId: task.stageId,
        taskId: task.id,
        type: exists ? "task.updated" : "task.created",
        title: exists
          ? `Задача изменена: ${task.name}`
          : `Задача добавлена: ${task.name}`,
      })
    : next;
}

export function stageForecast(
  state: GameState,
  goal: Goal,
  stage: GoalStage,
  now = new Date(),
) {
  const tasks = goalTasks(state, goal.id, stage.id).filter(
    (q) => q.required !== false,
  );
  const p = taskProgress(tasks);
  if (!p.remaining || !tasks.length) return undefined;
  const rows = stageSeries(
    { ...state, quests: state.quests.filter((q) => q.required !== false) },
    {
      ...goal,
      history: goal.history?.filter(
        (e) => !e.taskId || tasks.some((q) => q.id === e.taskId),
      ),
    },
    stage,
    "day",
  );
  const positive = rows.filter((r) => r.count > 0),
    net = rows.reduce((n, r) => n + r.count, 0);
  if (positive.length < 2 || net <= 0) return undefined;
  const today = dateKey(now),
    first = positive[0].date;
  if (first > today) return undefined;
  const elapsed = Math.max(1, dayOrdinal(today) - dayOrdinal(first) + 1),
    days = Math.ceil((p.remaining * elapsed) / net);
  return {
    days,
    date: new Date((dayOrdinal(today) + days) * 86400000)
      .toISOString()
      .slice(0, 10),
  };
}
