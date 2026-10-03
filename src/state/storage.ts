import type { GameState } from "../types";
import { demoState } from "../data/demo";
export interface StorageAdapter {
  load(): GameState;
  save(state: GameState): void;
}
export const storageKey = "play-your-life:v1";
export const localAdapter: StorageAdapter = {
  load() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return demoState();
      const s: unknown = JSON.parse(raw);
      if (isState(s)) return s;
    } catch {
      /* Fall back safely for unavailable or damaged storage. */
    }
    return demoState();
  },
  save(s) {
    localStorage.setItem(storageKey, JSON.stringify(s));
  },
};
function isState(value: unknown): value is GameState {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Partial<GameState>;
  return (
    s.version === 1 &&
    typeof s.name === "string" &&
    typeof s.xp === "number" &&
    Number.isFinite(s.xp) &&
    typeof s.coins === "number" &&
    Array.isArray(s.spheres) &&
    s.spheres.length === 9 &&
    s.spheres.every(
      (x) =>
        typeof x.id === "string" &&
        Number.isFinite(x.xp) &&
        Number.isFinite(x.best) &&
        Number.isFinite(x.score),
    ) &&
    Array.isArray(s.quests) &&
    s.quests.every(
      (x) => typeof x.title === "string" && Number.isFinite(x.xp),
    ) &&
    Array.isArray(s.goals) &&
    s.goals.every(
      (x) => typeof x.title === "string" && Number.isFinite(x.target),
    ) &&
    Array.isArray(s.events) &&
    Array.isArray(s.activityDays) &&
    Array.isArray(s.streakRewards) &&
    Array.isArray(s.achievements)
  );
}
