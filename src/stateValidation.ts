import { validPersonalState, validQuestExtension } from "./questValidation.ts";
import { SPHERE_PROGRESSION_MODEL } from "./sphereProgress.ts";
import { validCity, cityPrices, cityRooms } from "./city.ts";
import { validRooms } from "./roomEngine.ts";
import { shopItems } from "./shop.ts";
import { validProjectImage } from "./projectImage.ts";
import type { GameState } from "./game.ts";

type SavedState = Omit<GameState, "profile" | "mainGoalId"> &
  Partial<Pick<GameState, "profile" | "mainGoalId">>;
const sphereIds = [
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
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const number = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
const text = (v: unknown) => typeof v === "string";
const date = (v: unknown) =>
  text(v) && Number.isFinite(new Date(v as string).getTime());
const score = (v: unknown) =>
  number(v) && Number.isInteger(v) && (v as number) <= 9;
const optionalDate = (v: unknown) => v === undefined || date(v);
const optionalBoolean = (v: unknown) =>
  v === undefined || typeof v === "boolean";
const optionalText = (v: unknown) => v === undefined || text(v);
const reward = (v: unknown) =>
  v === undefined || (number(v) && Number.isInteger(v) && (v as number) <= 500);
function validCover(v: unknown) {
  if (v === undefined) return true;
  if (!record(v) || !text(v.url)) return false;
  try {
    if (new URL(v.url as string).protocol !== "https:") return false;
  } catch {
    return false;
  }
  return (
    text(v.path) &&
    text(v.name) &&
    date(v.uploadedAt) &&
    number(v.width) &&
    number(v.height) &&
    (v.width as number) > 0 &&
    (v.height as number) > 0 &&
    number(v.size) &&
    (v.size as number) <= 20 * 1024 * 1024 &&
    number(v.x) &&
    (v.x as number) <= 100 &&
    number(v.y) &&
    (v.y as number) <= 100 &&
    number(v.scale) &&
    (v.scale as number) >= 1 &&
    (v.scale as number) <= 3
  );
}
function validStage(stage: Record<string, unknown>) {
  return (
    text(stage.id) &&
    !!stage.id &&
    text(stage.name) &&
    optionalDate(stage.startsAt) &&
    optionalDate(stage.dueAt) &&
    optionalDate(stage.completedAt) &&
    optionalDate(stage.notesUpdatedAt) &&
    optionalDate(stage.reminder) &&
    optionalText(stage.description) &&
    optionalText(stage.notes) &&
    optionalText(stage.achievement) &&
    (stage.order === undefined ||
      (number(stage.order) && Number.isInteger(stage.order))) &&
    (stage.status === undefined ||
      ["planned", "active", "paused", "completed"].includes(
        stage.status as string,
      )) &&
    (stage.rarity === undefined ||
      ["common", "rare", "legendary"].includes(stage.rarity as string)) &&
    (stage.completionMode === undefined ||
      ["all", "manual"].includes(stage.completionMode as string)) &&
    reward(stage.rewardXP) &&
    reward(stage.rewardCoins) &&
    optionalBoolean(stage.rewardClaimed) &&
    optionalBoolean(stage.requiresPrevious) &&
    optionalBoolean(stage.autoComplete)
  );
}

function list(v: unknown, check: (item: Record<string, unknown>) => boolean) {
  return (
    Array.isArray(v) &&
    v.every((item) => record(item) && check(item)) &&
    new Set(v.map((item) => item.id)).size === v.length
  );
}
export function validateState(value: unknown): asserts value is SavedState {
  const fail = () => {
    throw new Error(
      "Файл содержит повреждённые или неподдерживаемые данные PLAY YOUR LIFE. Текущая игра не изменена.",
    );
  };
  if (!record(value) || value.version !== 1) return fail();
  if (!validPersonalState(value)) return fail();
  if (
    value.stageAchievements !== undefined &&
    !list(
      value.stageAchievements,
      (a) =>
        text(a.id) &&
        !!a.id &&
        text(a.goalId) &&
        text(a.stageId) &&
        text(a.name) &&
        date(a.earnedAt) &&
        ["common", "rare", "legendary"].includes(a.rarity as string),
    )
  )
    return fail();
  if (value.rooms !== undefined && !validRooms(value.rooms)) return fail();
  if (value.cityPurchases !== undefined) {
    if (
      !list(
        value.cityPurchases,
        (p) =>
          text(p.id) &&
          !!p.id &&
          text(p.sphere) &&
          Object.hasOwn(cityRooms, p.sphere as string) &&
          Number.isInteger(p.slot) &&
          (p.slot as number) >= 0 &&
          (p.slot as number) <= 2 &&
          p.price === cityPrices[p.slot as number] &&
          date(p.date),
      )
    )
      return fail();
    const purchases = value.cityPurchases as Record<string, unknown>[];
    if (
      new Set(purchases.map((p) => String(p.sphere) + ":" + String(p.slot)))
        .size !== purchases.length
    )
      return fail();
  }
  if (
    value.sphereProgressionModel !== undefined &&
    value.sphereProgressionModel !== SPHERE_PROGRESSION_MODEL &&
    value.sphereProgressionModel !== "xp-levels-100-v1"
  )
    return fail();
  if (value.city !== undefined && !validCity(value.city)) return fail();
  if (value.shop !== undefined) {
    const shop = value.shop;
    if (
      !record(shop) ||
      !list(
        shop.purchases,
        (p) =>
          text(p.id) &&
          !!p.id &&
          shopItems.some((i) => i.id === p.itemId) &&
          number(p.price) &&
          date(p.date) &&
          optionalDate(p.usedAt),
      )
    )
      return fail();
    if (
      shop.rewardTargetId !== undefined &&
      !shopItems.some(
        (i) => i.kind === "reward" && i.id === shop.rewardTargetId,
      )
    )
      return fail();
    const purchases = shop.purchases as Record<string, unknown>[];
    const frames = purchases.filter((p) =>
      shopItems.some((i) => i.id === p.itemId && i.kind === "frame"),
    );
    if (
      new Set(frames.map((p) => p.itemId)).size !== frames.length ||
      (shop.equippedFrame !== undefined &&
        !frames.some((p) => p.itemId === shop.equippedFrame))
    )
      return fail();
  }
  if (
    ![value.xp, value.coins, value.completed].every(number) ||
    !Number.isInteger(value.completed)
  )
    return fail();
  if (
    !record(value.spheres) ||
    !sphereIds.every((id) => {
      const s = (value.spheres as Record<string, unknown>)[id];
      return (
        record(s) &&
        number(s.xp) &&
        score(s.score) &&
        score(s.previousScore) &&
        score(s.highScore) &&
        (s.highScore as number) >= (s.score as number)
      );
    })
  )
    return fail();
  if (
    !list(
      value.quests,
      (q) =>
        validQuestExtension(q) &&
        text(q.id) &&
        !!q.id &&
        text(q.name) &&
        sphereIds.includes(q.sphere as string) &&
        number(q.xp) &&
        ["Micro", "Simple", "Medium", "Hard", "Very Hard"].includes(
          q.difficulty as string,
        ) &&
        (q.priority === undefined ||
          ["low", "normal", "high"].includes(q.priority as string)) &&
        typeof q.done === "boolean" &&
        optionalDate(q.startsAt) &&
        optionalDate(q.dueAt) &&
        optionalDate(q.completedAt) &&
        (q.estimateMinutes === undefined ||
          (number(q.estimateMinutes) &&
            (q.estimateMinutes as number) > 0 &&
            (q.estimateMinutes as number) <= 43200)) &&
        (q.goalId === undefined || text(q.goalId)) &&
        (q.stageId === undefined || text(q.stageId)) &&
        (q.notes === undefined || text(q.notes)) &&
        optionalBoolean(q.required) &&
        optionalText(q.recurrenceParentId) &&
        (q.recurrence === undefined ||
          ["none", "daily", "weekly", "monthly"].includes(
            q.recurrence as string,
          )),
    )
  )
    return fail();
  if (
    !list(
      value.goals,
      (g) =>
        text(g.id) &&
        !!g.id &&
        text(g.name) &&
        sphereIds.includes(g.sphere as string) &&
        validProjectImage(g.image) &&
        validCover(g.cover) &&
        optionalDate(g.updatedAt) &&
        (g.history === undefined ||
          list(
            g.history,
            (e) =>
              text(e.id) &&
              !!e.id &&
              text(e.type) &&
              text(e.title) &&
              date(e.timestamp) &&
              optionalText(e.stageId) &&
              optionalText(e.taskId) &&
              [e.xp, e.coins].every(
                (n) =>
                  n === undefined ||
                  (typeof n === "number" && Number.isFinite(n)),
              ),
          )) &&
        number(g.current) &&
        number(g.target) &&
        (g.target as number) > 0 &&
        number(g.reward) &&
        typeof g.rewarded === "boolean" &&
        date(g.created) &&
        optionalDate(g.startsAt) &&
        optionalDate(g.dueAt) &&
        (g.description === undefined || text(g.description)) &&
        (g.manualProgress === undefined ||
          (record(g.manualProgress) &&
            number(g.manualProgress.current) &&
            number(g.manualProgress.target) &&
            (g.manualProgress.target as number) > 0)) &&
        (g.progressMode === undefined ||
          ["manual", "tasks"].includes(g.progressMode as string)) &&
        (g.stages === undefined || list(g.stages, validStage)),
    )
  )
    return fail();
  if (
    !list(
      value.events,
      (e) =>
        (e.sourceId === undefined || text(e.sourceId)) &&
        text(e.id) &&
        !!e.id &&
        text(e.title) &&
        sphereIds.includes(e.sphere as string) &&
        number(e.xp) &&
        date(e.date),
    )
  )
    return fail();
  if (
    !Array.isArray(value.activeDates) ||
    !value.activeDates.every(date) ||
    !Array.isArray(value.streakClaims) ||
    !value.streakClaims.every(text)
  )
    return fail();
  if (
    value.profile !== undefined &&
    (!record(value.profile) ||
      !text(value.profile.name) ||
      !(value.profile.name as string).trim() ||
      !["character", "🧑🏻‍🚀", "👩🏻‍🚀", "🦊", "🐼", "🦁", "🦉"].includes(
        value.profile.avatar as string,
      ) ||
      !["demo", "personal"].includes(value.profile.mode as string) ||
      (value.profile.onboardingComplete !== undefined &&
        typeof value.profile.onboardingComplete !== "boolean"))
  )
    return fail();
  if (
    value.monthlyTracking !== undefined &&
    (!record(value.monthlyTracking) ||
      !date(value.monthlyTracking.since) ||
      !record(value.monthlyTracking.scores) ||
      !sphereIds.every((id) =>
        score(
          (value.monthlyTracking as { scores: Record<string, unknown> }).scores[
            id
          ],
        ),
      ))
  )
    return fail();
  if (
    value.monthlyReflections !== undefined &&
    (!record(value.monthlyReflections) ||
      !Object.entries(value.monthlyReflections).every(
        ([key, r]) =>
          /^\d{4}-\d{2}$/.test(key) &&
          record(r) &&
          [r.highlights, r.challenges, r.lessons, r.nextMonth].every(text) &&
          (r.mood === null ||
            (number(r.mood) &&
              Number.isInteger(r.mood) &&
              (r.mood as number) >= 1 &&
              (r.mood as number) <= 5)) &&
          ["draft", "completed"].includes(r.status as string) &&
          date(r.updatedAt),
      ))
  )
    return fail();
}
