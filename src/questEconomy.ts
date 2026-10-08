import type { GameState } from "./game.ts";
import {
  checkCoins,
  habitDay,
  questCoins,
  virtualRewards,
} from "./personalQuests.ts";
export type EconomyRecord = {
  type: "quest" | "habit" | "stage";
  coins: number;
  xp: number;
  item: string;
  sphere: string;
  locked: boolean;
  completed: boolean;
  progress: number;
  claims: Record<string, true>;
  offset: number;
  weekdays: number[];
  active: boolean;
  createdDay: number;
};
export type EconomyRecords = Record<string, EconomyRecord>;
export function economyRecords(
  state: GameState,
  previous: EconomyRecords = {},
  includeStages = true,
): EconomyRecords {
  const next: EconomyRecords = structuredClone(previous);
  for (const q of state.quests) {
    const key = `quest:${q.id}`,
      old = previous[key];
    const r: EconomyRecord = {
      type: "quest",
      coins: checkCoins(questCoins(q), 100),
      xp: q.xp,
      item: q.virtualRewardId ?? "",
      sphere: q.sphere,
      locked: !!q.done || !!q.rewardLocked || (q.currentValue ?? 0) > 0,
      completed: q.done,
      progress: q.currentValue ?? (q.done ? 1 : 0),
      claims: {},
      offset: 0,
      weekdays: [],
      active: true,
      createdDay: 0,
    };
    if (r.item && !virtualRewards.some((i) => i.id === r.item))
      throw new Error("Недопустимая виртуальная награда.");
    if (
      old &&
      ((old.completed && !r.completed && !q.goalId) ||
        (old.progress > r.progress &&
          !(old.completed && !r.completed && q.goalId)) ||
        (old.locked &&
          (old.coins !== r.coins ||
            old.xp !== r.xp ||
            old.item !== r.item ||
            old.sphere !== r.sphere)))
    )
      throw new Error(
        "Зафиксированную награду или выполнение нельзя изменить.",
      );
    next[key] = r;
  }
  for (const goal of includeStages ? state.goals : [])
    for (const stage of goal.stages ?? []) {
      const id = `stage:${goal.id}:${stage.id}`,
        old = previous[id];
      const r: EconomyRecord = {
        type: "stage",
        coins: stage.rewardCoins ?? 0,
        xp: stage.rewardXP ?? 0,
        item: "",
        sphere: goal.sphere,
        locked: !!stage.rewardClaimed,
        completed: !!stage.rewardClaimed,
        progress: 0,
        claims: {},
        offset: 0,
        weekdays: [],
        active: true,
        createdDay: 0,
      };
      if (
        !Number.isSafeInteger(r.xp) ||
        r.xp < 0 ||
        r.xp > 500 ||
        !Number.isSafeInteger(r.coins) ||
        r.coins < 0 ||
        r.coins > 500
      )
        throw new Error("Недопустимая награда этапа.");
      if (
        old?.locked &&
        (r.xp !== old.xp ||
          r.coins !== old.coins ||
          r.sphere !== old.sphere ||
          !r.completed)
      )
        throw new Error("Награда этапа уже зафиксирована.");
      next[id] = r;
    }
  for (const h of state.habits ?? []) {
    const key = `habit:${h.id}`,
      old = previous[key],
      claims = { ...old?.claims };
    for (const c of state.habitCompletions ?? [])
      if (c.habitId === h.id && c.rewardClaimed)
        claims[
          String(Math.floor(Date.parse(`${c.day}T00:00:00Z`) / 86400000))
        ] = true;
    const r: EconomyRecord = {
      type: "habit",
      coins: checkCoins(h.rewardCoins, 10),
      xp: 5,
      item: "",
      sphere: h.sphere,
      locked: h.rewardLocked || Object.keys(claims).length > 0,
      completed: false,
      progress: 0,
      claims,
      offset: h.timezoneMinutes || 0,
      weekdays: h.weekdays,
      active: h.isActive,
      createdDay: Math.floor(
        (Date.parse(h.createdAt) + h.timezoneMinutes * 60000) / 86400000,
      ),
    };
    if (
      old &&
      (old.offset !== r.offset ||
        (old.locked && (old.coins !== r.coins || old.sphere !== r.sphere)))
    )
      throw new Error("Зафиксированную награду привычки нельзя изменить.");
    next[key] = r;
  }
  return next;
}
export function recordIncome(
  old: EconomyRecord | undefined,
  next: EconomyRecord,
): number {
  if (!old) return 0;
  return next.type !== "habit"
    ? !old.completed && next.completed
      ? old.coins
      : old.completed && !next.completed
        ? -old.coins
        : 0
    : Object.keys(next.claims).filter((day) => !old.claims[day]).length *
        old.coins;
}
export function recordChanges(old: EconomyRecords, next: EconomyRecords) {
  return Object.keys(next).filter(
    (id) => JSON.stringify(old[id]) !== JSON.stringify(next[id]),
  );
}
/** Trust the stored balance and previously approved reward definitions, never a client balance increment. */
export function validateIncome(
  previous: GameState,
  next: GameState,
  records: EconomyRecords,
) {
  const wanted = economyRecords(next, records),
    delta = Object.entries(wanted).reduce(
      (sum, [id, r]) => sum + recordIncome(records[id], r),
      0,
    );
  if (next.coins > previous.coins + delta)
    throw new Error(
      "Баланс не соответствует однократным наградам квестов и привычек.",
    );
  return wanted;
}
/** Intermediate snapshots keep pending completions unpaid; each paid status is saved with its receipt. */
export function stageRewards(
  target: GameState,
  records: EconomyRecords,
  wanted: EconomyRecords,
): GameState {
  const next = structuredClone(target);
  const sphereWithheld: Record<string, number> = {};
  let coins = 0,
    xp = 0,
    completed = 0;
  const pending = new Set<string>();
  next.goals = next.goals.map((goal) => ({
    ...goal,
    stages: goal.stages?.map((stage) => {
      const id = `stage:${goal.id}:${stage.id}`;
      if (!wanted[id]?.completed || records[id]?.completed) return stage;
      coins += wanted[id].coins;
      xp += wanted[id].xp;
      sphereWithheld[goal.sphere] =
        (sphereWithheld[goal.sphere] ?? 0) + wanted[id].xp;
      return {
        ...stage,
        rewardClaimed: false,
        status: "active" as const,
        completedAt: undefined,
      };
    }),
  }));
  next.stageAchievements = next.stageAchievements?.filter(
    (a) => records[a.id]?.completed || !wanted[a.id],
  );
  next.quests = next.quests.map((q) => {
    const key = `quest:${q.id}`;
    if (records[key]?.completed && !wanted[key]?.completed) {
      coins -= records[key].coins;
      xp -= records[key].xp;
      completed--;
      sphereWithheld[q.sphere] =
        (sphereWithheld[q.sphere] ?? 0) - records[key].xp;
      return {
        ...q,
        done: true,
        rewardClaimed: true,
        currentValue: q.targetValue ?? 1,
        completedAt: new Date().toISOString(),
        rewardClaimedAt: new Date().toISOString(),
      };
    }
    if (!wanted[key]?.completed || records[key]?.completed) return q;
    coins += wanted[key].coins;
    xp += wanted[key].xp;
    sphereWithheld[q.sphere] = (sphereWithheld[q.sphere] ?? 0) + wanted[key].xp;
    completed++;
    pending.add(key);
    return {
      ...q,
      done: false,
      rewardClaimed: false,
      rewardClaimedAt: undefined,
      completedAt: undefined,
      currentValue: Math.min(records[key]?.progress ?? 0, q.targetValue ?? 1),
    };
  });
  next.habitCompletions = next.habitCompletions?.filter((c) => {
    const key = `habit:${c.habitId}`,
      day = String(Math.floor(Date.parse(`${c.day}T00:00:00Z`) / 86400000));
    if (records[key]?.claims[day]) return true;
    if (wanted[key]?.claims[day]) {
      coins += wanted[key].coins;
      xp += 5;
      const sphere = wanted[key].sphere;
      sphereWithheld[sphere] = (sphereWithheld[sphere] ?? 0) + 5;
      pending.add(c.id);
      return false;
    }
    return true;
  });
  next.habits = next.habits?.map((h) => {
    const history =
      next.habitCompletions?.filter((c) => c.habitId === h.id) ?? [];
    return {
      ...h,
      totalCompletions: history.length,
      currentStreak: Math.min(h.currentStreak, history.length),
      bestStreak: Math.min(h.bestStreak, history.length),
    };
  });
  next.coins = Math.max(0, next.coins - coins);
  next.xp = Math.max(0, next.xp - xp);
  next.completed -= completed;
  for (const [sphere, xp] of Object.entries(sphereWithheld))
    next.spheres[sphere].xp = Math.max(0, next.spheres[sphere].xp - xp);
  next.coinTransactions = next.coinTransactions?.filter(
    (t) => !pending.has(t.transactionId),
  );
  next.rewardInventory = next.rewardInventory?.filter(
    (i) => !pending.has(i.id),
  );
  next.events = next.events.filter((e) => {
    if (!e.sourceId) return true;
    if (e.kind === "quest") return !pending.has(`quest:${e.sourceId}`);
    if (e.kind === "habit") {
      const h = target.habits?.find((h) => h.id === e.sourceId);
      return (
        !h || !pending.has(`habit:${h.id}:${habitDay(h, new Date(e.date))}`)
      );
    }
    return true;
  });
  return next;
}
