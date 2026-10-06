import { difficulties } from "./game.ts";
import { habitIcons, virtualRewards } from "./personalQuests.ts";
import { validProjectImage } from "./projectImage.ts";
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown) => typeof v === "string";
const number = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
const integer = (v: unknown, max = Number.MAX_SAFE_INTEGER) =>
  number(v) && Number.isSafeInteger(v) && Number(v) <= max;
const date = (v: unknown) => text(v) && Number.isFinite(Date.parse(String(v)));
const bool = (v: unknown) => typeof v === "boolean";
const spheres = [
  "health",
  "sport",
  "growth",
  "english",
  "finance",
  "together",
  "driving",
  "tasks",
  "hobby",
];
function list(
  v: unknown,
  key: string,
  check: (r: Record<string, unknown>) => boolean,
) {
  return (
    v === undefined ||
    (Array.isArray(v) &&
      v.every((i) => record(i) && text(i[key]) && !!i[key] && check(i)) &&
      new Set(v.map((i) => i[key])).size === v.length)
  );
}
export function validQuestExtension(q: Record<string, unknown>) {
  return (
    (q.sourceType === undefined ||
      ["SYSTEM", "USER_CREATED"].includes(String(q.sourceType))) &&
    (q.ownerId === undefined || text(q.ownerId)) &&
    (q.createdAt === undefined || date(q.createdAt)) &&
    validProjectImage(q.coverImage) &&
    (q.targetValue === undefined ||
      (number(q.targetValue) &&
        Number(q.targetValue) > 0 &&
        Number(q.targetValue) <= 1000000)) &&
    (q.currentValue === undefined ||
      (number(q.currentValue) &&
        Number(q.currentValue) <= Number(q.targetValue ?? 1))) &&
    (q.unit === undefined || (text(q.unit) && String(q.unit).length <= 30)) &&
    (q.rewardCoins === undefined || integer(q.rewardCoins, 100)) &&
    (q.virtualRewardId === undefined ||
      virtualRewards.some((i) => i.id === q.virtualRewardId)) &&
    (q.rewardClaimed === undefined || bool(q.rewardClaimed)) &&
    (q.rewardLocked === undefined || bool(q.rewardLocked)) &&
    (q.rewardClaimedAt === undefined || date(q.rewardClaimedAt)) &&
    (q.sourceType !== "USER_CREATED" ||
      (text(q.ownerId) &&
        !!q.ownerId &&
        integer(q.rewardCoins, 100) &&
        q.xp ===
          difficulties[String(q.difficulty) as keyof typeof difficulties] &&
        (!q.done || (q.rewardClaimed === true && date(q.rewardClaimedAt))))) &&
    (!q.rewardClaimed || q.done === true)
  );
}
export function validPersonalState(s: Record<string, unknown>) {
  return (
    list(
      s.habits,
      "id",
      (h) =>
        typeof h.timezoneMinutes === "number" &&
        Number.isInteger(h.timezoneMinutes) &&
        h.timezoneMinutes >= -720 &&
        h.timezoneMinutes <= 840 &&
        text(h.ownerId) &&
        !!h.ownerId &&
        text(h.title) &&
        !!String(h.title).trim() &&
        String(h.title).length <= 100 &&
        spheres.includes(String(h.sphere)) &&
        habitIcons.some(([id]) => id === h.iconId) &&
        number(h.targetValue) &&
        Number(h.targetValue) > 0 &&
        Number(h.targetValue) <= 1000000 &&
        text(h.unit) &&
        String(h.unit).length <= 30 &&
        Array.isArray(h.weekdays) &&
        h.weekdays.length > 0 &&
        h.weekdays.every((d) => integer(d, 6)) &&
        new Set(h.weekdays).size === h.weekdays.length &&
        integer(h.rewardCoins, 10) &&
        h.rewardXp === 5 &&
        bool(h.isActive) &&
        integer(h.currentStreak) &&
        integer(h.bestStreak) &&
        Number(h.bestStreak) >= Number(h.currentStreak) &&
        integer(h.totalCompletions) &&
        date(h.createdAt) &&
        bool(h.rewardLocked),
    ) &&
    list(
      s.habitCompletions,
      "id",
      (c) =>
        integer(c.dayOrdinal) &&
        c.dayOrdinal ===
          Math.floor(Date.parse(String(c.day) + "T00:00:00Z") / 86400000) &&
        text(c.habitId) &&
        text(c.ownerId) &&
        text(c.day) &&
        /^\d{4}-\d{2}-\d{2}$/.test(String(c.day)) &&
        date(c.day) &&
        number(c.value) &&
        date(c.completedAt) &&
        c.rewardClaimed === true &&
        date(c.rewardClaimedAt) &&
        c.id === `habit:${c.habitId}:${c.day}`,
    ) &&
    list(
      s.coinTransactions,
      "transactionId",
      (t) =>
        text(t.userId) &&
        integer(
          t.amount,
          t.type === "HABIT_REWARD"
            ? 10
            : t.sourceType === "USER_CREATED"
              ? 100
              : Number.MAX_SAFE_INTEGER,
        ) &&
        ["QUEST_REWARD", "HABIT_REWARD"].includes(String(t.type)) &&
        ["USER_CREATED", "SYSTEM", "DAILY_HABIT"].includes(
          String(t.sourceType),
        ) &&
        text(t.sourceId) &&
        text(t.title) &&
        date(t.createdAt),
    ) &&
    list(
      s.rewardInventory,
      "id",
      (i) =>
        virtualRewards.some((r) => r.id === i.itemId) &&
        text(i.sourceId) &&
        date(i.earnedAt) &&
        (i.placedIn === undefined || i.placedIn === "sport"),
    )
  );
}
