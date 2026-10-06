import {
  award,
  completeQuest,
  dateKey,
  difficulties,
  spheres,
} from "./game.ts";
import type { GameState, Quest } from "./game.ts";
import { validProjectImage } from "./projectImage.ts";
export const MAX_CUSTOM_QUEST_COINS = 100;
export const MAX_DAILY_HABIT_COINS = 10;
export const HABIT_XP = 5;
export const habitIcons = [
  ["water", "💧", "Вода"],
  ["steps", "👟", "Шаги"],
  ["reading", "📖", "Чтение"],
  ["meditation", "🧘", "Медитация"],
  ["training", "🏋️", "Тренировка"],
  ["food", "🍎", "Питание"],
  ["sleep", "🌙", "Сон"],
  ["english", "🇬🇧", "Английский"],
  ["finance", "💰", "Финансы"],
  ["driving", "🚗", "Вождение"],
  ["art", "🎨", "Хобби"],
  ["learning", "🧠", "Обучение"],
] as const;
export const virtualRewards = [
  { id: "plant_basic", icon: "🪴", name: "Растение" },
  { id: "book_basic", icon: "📚", name: "Книга" },
  { id: "cup_basic", icon: "🏆", name: "Кубок" },
  { id: "crown_basic", icon: "👑", name: "Корона" },
  { id: "key_basic", icon: "🔑", name: "Ключ" },
  { id: "medal_basic", icon: "🎖️", name: "Медаль" },
] as const;
export type Habit = {
  timezoneMinutes: number;
  id: string;
  ownerId: string;
  title: string;
  sphere: string;
  iconId: string;
  targetValue: number;
  unit: string;
  weekdays: number[];
  rewardCoins: number;
  rewardXp: number;
  isActive: boolean;
  currentStreak: number;
  bestStreak: number;
  totalCompletions: number;
  createdAt: string;
  rewardLocked: boolean;
};
export type HabitCompletion = {
  id: string;
  habitId: string;
  ownerId: string;
  dayOrdinal: number;
  day: string;
  value: number;
  completedAt: string;
  rewardClaimed: boolean;
  rewardClaimedAt?: string;
};
export type CoinTransaction = {
  transactionId: string;
  userId: string;
  amount: number;
  type: "QUEST_REWARD" | "HABIT_REWARD";
  sourceType: "USER_CREATED" | "SYSTEM" | "DAILY_HABIT";
  sourceId: string;
  title: string;
  createdAt: string;
};
export type RewardItem = {
  id: string;
  itemId: string;
  sourceId: string;
  earnedAt: string;
  placedIn?: "sport";
};
export function checkCoins(value: number, max: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max)
    throw new Error(
      `Награда должна быть целым числом от 0 до ${max} Life Coins.`,
    );
  return value === 0 ? 0 : value;
}
export function questCoins(q: Quest) {
  return q.sourceType === "USER_CREATED"
    ? checkCoins(q.rewardCoins ?? 0, 100)
    : Math.ceil(q.xp / 5);
}
function checkSphere(id: string) {
  if (!spheres.some((s) => s.id === id))
    throw new Error("Выбери одну из девяти сфер.");
}
export function saveCustomQuest(
  state: GameState,
  input: Partial<Quest> & Pick<Quest, "name" | "sphere" | "difficulty">,
  ownerId: string,
): GameState {
  const old = input.id
    ? state.quests.find((q) => q.id === input.id)
    : undefined;
  if (old?.ownerId && old.ownerId !== ownerId)
    throw new Error("Это квест другого пользователя.");
  if (input.id && !old) throw new Error("Квест не найден.");
  if (old?.done) throw new Error("Выполненный квест нельзя менять.");
  const name = input.name.trim();
  if (!name || name.length > 100 || (input.notes?.length ?? 0) > 2000)
    throw new Error("Проверь название и описание.");
  checkSphere(input.sphere);
  const xp = difficulties[input.difficulty as keyof typeof difficulties];
  if (!Object.hasOwn(difficulties, input.difficulty))
    throw new Error("Выбери сложность.");
  const targetValue = input.targetValue ?? 1;
  if (
    !Number.isFinite(targetValue) ||
    targetValue <= 0 ||
    targetValue > 1000000 ||
    (input.unit?.length ?? 0) > 30
  )
    throw new Error("Проверь цель и единицу измерения.");
  if (!validProjectImage(input.coverImage))
    throw new Error("Некорректная обложка.");
  for (const date of [input.startsAt, input.dueAt])
    if (date && !Number.isFinite(Date.parse(date)))
      throw new Error("Проверь даты.");
  if (input.startsAt && input.dueAt && input.dueAt < input.startsAt)
    throw new Error("Дедлайн не может быть раньше начала.");
  const locked = !!old && (old.rewardLocked || (old.currentValue ?? 0) > 0);
  const rewardCoins = checkCoins(
    input.rewardCoins ?? (old ? questCoins(old) : 0),
    100,
  );
  if (
    locked &&
    (rewardCoins !== questCoins(old!) ||
      input.difficulty !== old!.difficulty ||
      input.sphere !== old!.sphere ||
      input.virtualRewardId !== old!.virtualRewardId)
  )
    throw new Error(
      "После начала прогресса награда, сложность и сфера зафиксированы.",
    );
  if (
    input.virtualRewardId &&
    !virtualRewards.some((i) => i.id === input.virtualRewardId)
  )
    throw new Error("Предмет отсутствует в каталоге наград.");
  if (targetValue < (old?.currentValue ?? 0))
    throw new Error("Цель не может быть меньше прогресса.");
  const q: Quest = {
    ...old,
    id: old?.id ?? crypto.randomUUID(),
    ownerId,
    sourceType: "USER_CREATED",
    name,
    sphere: input.sphere,
    difficulty: input.difficulty,
    xp,
    notes: input.notes?.trim(),
    coverImage: input.coverImage,
    targetValue,
    currentValue: old?.currentValue ?? 0,
    unit: input.unit?.trim() ?? "",
    rewardCoins,
    virtualRewardId: input.virtualRewardId || undefined,
    startsAt: input.startsAt || undefined,
    dueAt: input.dueAt || undefined,
    priority: input.priority ?? "normal",
    createdAt: old?.createdAt ?? new Date().toISOString(),
    done: false,
    rewardLocked: locked,
    rewardClaimed: false,
  };
  const clean = Object.fromEntries(
    Object.entries(q).filter(([, v]) => v !== undefined),
  ) as Quest;
  return {
    ...state,
    quests: old
      ? state.quests.map((item) => (item.id === old.id ? clean : item))
      : [...state.quests, clean],
  };
}
export function progressQuest(
  state: GameState,
  id: string,
  value: number,
  ownerId: string,
): GameState {
  const q = state.quests.find((item) => item.id === id);
  if (!q || q.done || q.rewardClaimed) return state;
  if (q.ownerId && q.ownerId !== ownerId)
    throw new Error("Это квест другого пользователя.");
  if (q.startsAt && Date.parse(q.startsAt) > Date.now())
    throw new Error("Квест ещё не начался.");
  const target = q.targetValue ?? 1;
  if (
    !Number.isFinite(value) ||
    value < (q.currentValue ?? 0) ||
    value > target
  )
    throw new Error("Прогресс нельзя уменьшить или превысить цель.");
  const next = {
    ...state,
    quests: state.quests.map((item) =>
      item.id === id
        ? {
            ...item,
            currentValue: value,
            rewardLocked: value > 0 || item.rewardLocked,
          }
        : item,
    ),
  };
  return value === target ? completeQuest(next, id) : next;
}
export function recordQuestReward(
  state: GameState,
  q: Quest,
  coins: number,
): GameState {
  const now = new Date().toISOString(),
    id = `quest:${q.id}`;
  if (
    q.virtualRewardId &&
    !virtualRewards.some((i) => i.id === q.virtualRewardId)
  )
    throw new Error("Недопустимый предмет награды.");
  if (state.coinTransactions?.some((t) => t.transactionId === id))
    throw new Error("Награда уже получена.");
  return {
    ...state,
    coinTransactions: [
      ...(state.coinTransactions ?? []),
      {
        transactionId: id,
        userId: q.ownerId ?? "",
        amount: coins,
        type: "QUEST_REWARD",
        sourceType: q.sourceType ?? "SYSTEM",
        sourceId: q.id,
        title: q.name,
        createdAt: now,
      },
    ],
    ...(q.virtualRewardId
      ? {
          rewardInventory: [
            ...(state.rewardInventory ?? []),
            { id, itemId: q.virtualRewardId, sourceId: q.id, earnedAt: now },
          ],
        }
      : {}),
  };
}
export function habitDate(h: Habit, now = new Date()) {
  return new Date(now.getTime() + h.timezoneMinutes * 60000);
}
export function habitDay(h: Habit, now = new Date()) {
  return habitDate(h, now).toISOString().slice(0, 10);
}
export function habitDue(h: Habit, now = new Date()) {
  return (
    h.isActive &&
    habitDay(h, new Date(h.createdAt)) <= habitDay(h, now) &&
    h.weekdays.includes(habitDate(h, now).getUTCDay())
  );
}
export function habitStreak(
  h: Habit,
  history: HabitCompletion[],
  now = new Date(),
) {
  const dates = new Set(
      history
        .filter((c) => c.habitId === h.id && c.rewardClaimed)
        .map((c) => c.day),
    ),
    cursor = habitDate(h, now);
  if (!dates.has(cursor.toISOString().slice(0, 10)))
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  let count = 0;
  for (let i = 0; i < 36600; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (key < habitDay(h, new Date(h.createdAt))) break;
    if (h.weekdays.includes(cursor.getUTCDay())) {
      if (!dates.has(key)) break;
      count++;
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return count;
}
export function saveHabit(
  state: GameState,
  input: Pick<
    Habit,
    | "title"
    | "sphere"
    | "iconId"
    | "targetValue"
    | "unit"
    | "weekdays"
    | "rewardCoins"
  > &
    Partial<Habit>,
  ownerId: string,
): GameState {
  const old = input.id
    ? state.habits?.find((h) => h.id === input.id)
    : undefined;
  if (input.id && !old) throw new Error("Привычка не найдена.");
  if (old && old.ownerId !== ownerId)
    throw new Error("Это привычка другого пользователя.");
  if (!input.title.trim() || input.title.length > 100 || input.unit.length > 30)
    throw new Error("Проверь название и единицу измерения.");
  checkSphere(input.sphere);
  if (!habitIcons.some(([id]) => id === input.iconId))
    throw new Error("Выбери иконку из библиотеки.");
  if (
    !Number.isFinite(input.targetValue) ||
    input.targetValue <= 0 ||
    input.targetValue > 1000000
  )
    throw new Error("Проверь цель.");
  if (
    !input.weekdays.length ||
    input.weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
  )
    throw new Error("Выбери дни повторения.");
  const rewardCoins = checkCoins(input.rewardCoins, 10);
  if (
    old?.rewardLocked &&
    (rewardCoins !== old.rewardCoins || input.sphere !== old.sphere)
  )
    throw new Error("Награда и сфера зафиксированы после первого выполнения.");
  const h: Habit = {
    ...old,
    timezoneMinutes:
      (old?.timezoneMinutes ?? -new Date().getTimezoneOffset()) || 0,
    id: old?.id ?? crypto.randomUUID(),
    ownerId,
    title: input.title.trim(),
    sphere: input.sphere,
    iconId: input.iconId,
    targetValue: input.targetValue,
    unit: input.unit.trim(),
    weekdays: [...new Set(input.weekdays)].sort(),
    rewardCoins,
    rewardXp: HABIT_XP,
    isActive: input.isActive ?? true,
    currentStreak: old?.currentStreak ?? 0,
    bestStreak: old?.bestStreak ?? 0,
    totalCompletions: old?.totalCompletions ?? 0,
    createdAt: old?.createdAt ?? new Date().toISOString(),
    rewardLocked: old?.rewardLocked ?? false,
  };
  return {
    ...state,
    habits: old
      ? state.habits!.map((item) => (item.id === old.id ? h : item))
      : [...(state.habits ?? []), h],
  };
}
export function completeHabit(
  state: GameState,
  id: string,
  ownerId: string,
  now = new Date(),
): GameState {
  const h = state.habits?.find((item) => item.id === id);
  if (!h) return state;
  if (h.ownerId !== ownerId)
    throw new Error("Это привычка другого пользователя.");
  if (!habitDue(h, now)) throw new Error("Сегодня привычка не запланирована.");
  const day = habitDay(h, now),
    claimId = `habit:${id}:${day}`;
  if (
    state.habitCompletions?.some((c) => c.id === claimId) ||
    state.coinTransactions?.some((t) => t.transactionId === claimId)
  )
    return state;
  const coins = checkCoins(h.rewardCoins, 10),
    time = now.toISOString();
  const history = [
    ...(state.habitCompletions ?? []),
    {
      id: claimId,
      habitId: id,
      ownerId,
      dayOrdinal: Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000),
      day,
      value: h.targetValue,
      completedAt: time,
      rewardClaimed: true,
      rewardClaimedAt: time,
    },
  ];
  const currentStreak = habitStreak(h, history, now),
    next = award(state, h.sphere, HABIT_XP, h.title, {
      kind: "habit",
      sourceId: h.id,
    });
  return {
    ...next,
    events: [{ ...next.events[0], date: time }, ...next.events.slice(1)],
    coins: next.coins + coins,
    activeDates: [...new Set([...next.activeDates, dateKey(now)])],
    habitCompletions: history,
    habits: state.habits!.map((item) =>
      item.id === id
        ? {
            ...item,
            rewardLocked: true,
            currentStreak,
            bestStreak: Math.max(item.bestStreak, currentStreak),
            totalCompletions: item.totalCompletions + 1,
          }
        : item,
    ),
    coinTransactions: [
      ...(state.coinTransactions ?? []),
      {
        transactionId: claimId,
        userId: ownerId,
        amount: coins,
        type: "HABIT_REWARD",
        sourceType: "DAILY_HABIT",
        sourceId: id,
        title: h.title,
        createdAt: time,
      },
    ],
  };
}
export function removeHabit(
  state: GameState,
  id: string,
  ownerId: string,
): GameState {
  const h = state.habits?.find((item) => item.id === id);
  if (h && h.ownerId !== ownerId)
    throw new Error("Это привычка другого пользователя.");
  return {
    ...state,
    habits: state.habits?.filter((item) => item.id !== id),
    habitCompletions: state.habitCompletions?.filter((c) => c.habitId !== id),
  };
}
export function putRewardInSport(state: GameState, id: string): GameState {
  const item = state.rewardInventory?.find((i) => i.id === id);
  if (!item || item.itemId !== "plant_basic")
    throw new Error("Для этого предмета ещё готовится 3D-модель.");
  const room = state.rooms?.sport ?? { purchased: [], objects: [] };
  return {
    ...state,
    rooms: {
      ...state.rooms,
      sport: {
        ...room,
        purchased: [...new Set([...room.purchased, "plant" as const])],
      },
    },
    rewardInventory: state.rewardInventory!.map((i) =>
      i.id === id ? { ...i, placedIn: "sport" } : i,
    ),
  };
}
