import type { GameState, Goal, Quest, SphereId } from "../types";
import { milestones } from "../data/demo";
import { dayKey, streak } from "../utils/date";
export const level = (xp: number) => Math.floor(xp / 200) + 1;
export const levelTitle = (xp: number) =>
  xp >= 2400 ? "Стратег" : xp >= 1000 ? "Исследователь" : "Новичок";
export function levelProgress(xp: number) {
  return { current: xp % 200, target: 200, percent: (xp % 200) / 2 };
}
export type Action =
  | { type: "complete"; id: string }
  | { type: "score"; id: SphereId; score: number }
  | { type: "addQuest"; quest: Quest }
  | { type: "deleteQuest"; id: string }
  | { type: "addGoal"; goal: Goal }
  | { type: "goalProgress"; id: string; current: number }
  | { type: "name"; name: string };
function award(
  s: GameState,
  xp: number,
  title: string,
  kind: GameState["events"][number]["kind"],
  date: Date,
  sphere?: SphereId,
) {
  s.xp += xp;
  if (sphere) {
    const item = s.spheres.find((x) => x.id === sphere);
    if (item) item.xp += xp;
  }
  s.events.unshift({
    id: crypto.randomUUID(),
    title,
    xp,
    kind,
    date: date.toISOString(),
    ...(sphere ? { sphere } : {}),
  });
}
function unlock(s: GameState, now: Date) {
  const ids = [
    s.quests.some((q) => q.completedAt) ? "first" : "",
    streak(s.activityDays, dayKey(now)) >= 7 ? "week" : "",
    s.xp >= 1000 ? "thousand" : "",
    level(s.spheres.find((x) => x.id === "sport")?.xp ?? 0) >= 5
      ? "athlete"
      : "",
  ];
  for (const id of ids)
    if (id && !s.achievements.includes(id)) s.achievements.push(id);
}
export function reduceGame(
  state: GameState,
  action: Action,
  now = new Date(),
): GameState {
  const s = structuredClone(state);
  switch (action.type) {
    case "complete": {
      const q = s.quests.find((x) => x.id === action.id);
      if (!q || q.completedAt) return state;
      q.completedAt = now.toISOString();
      award(s, q.xp, q.title, "action", now, q.sphere);
      s.coins += Math.max(1, Math.floor(q.xp / 5));
      const today = dayKey(now);
      if (!s.activityDays.includes(today)) {
        s.activityDays.push(today);
        const count = streak(s.activityDays, today);
        const reward = milestones[count];
        const key = `${today}:${count}`;
        if (reward && !s.streakRewards.includes(key)) {
          s.streakRewards.push(key);
          award(s, reward, `Серия ${count} дней`, "streak", now);
        }
      }
      break;
    }
    case "score": {
      const sphere = s.spheres.find((x) => x.id === action.id);
      if (
        !sphere ||
        !Number.isInteger(action.score) ||
        action.score < 0 ||
        action.score > 9 ||
        sphere.score === action.score
      )
        return state;
      const xp = Math.max(0, action.score - sphere.best) * sphere.coefficient;
      sphere.previous = sphere.score;
      sphere.score = action.score;
      sphere.best = Math.max(sphere.best, action.score);
      award(
        s,
        xp,
        `Life Score: ${sphere.previous} → ${sphere.score}`,
        "score",
        now,
        sphere.id,
      );
      break;
    }
    case "addQuest":
      if (
        !action.quest.title.trim() ||
        s.quests.some((q) => q.id === action.quest.id)
      )
        return state;
      s.quests.unshift(action.quest);
      break;
    case "deleteQuest":
      s.quests = s.quests.filter((q) => q.id !== action.id);
      break;
    case "addGoal":
      if (
        !action.goal.title.trim() ||
        action.goal.target <= 0 ||
        s.goals.some((g) => g.id === action.goal.id)
      )
        return state;
      s.goals.unshift(action.goal);
      break;
    case "goalProgress": {
      const g = s.goals.find((x) => x.id === action.id);
      if (!g || !Number.isFinite(action.current)) return state;
      g.current = Math.min(g.target, Math.max(0, action.current));
      if (g.current >= g.target && !g.rewarded) {
        g.rewarded = true;
        award(s, g.reward, `Цель: ${g.title}`, "goal", now, g.sphere);
      }
      break;
    }
    case "name":
      s.name = action.name.trim().slice(0, 40) || "Игрок";
      break;
  }
  unlock(s, now);
  return s;
}
