/** Canonical sphere progression. Player progression is independent. */
export const MIN_SPHERE_LEVEL = 0;
export const MAX_SPHERE_LEVEL = 100;
export const SPHERE_XP_PER_LEVEL = 200;
export const SPHERE_PROGRESSION_MODEL = 'xp-levels-100-v1' as const;
export function sphereProgress(xp: number) {
  const totalXP = Number.isFinite(xp) ? Math.max(0, xp) : 0;
  const level = Math.min(MAX_SPHERE_LEVEL, Math.floor(totalXP / SPHERE_XP_PER_LEVEL));
  const maxed = level === MAX_SPHERE_LEVEL;
  const currentXP = maxed ? 0 : totalXP - level * SPHERE_XP_PER_LEVEL;
  return { level, totalXP, maxed, currentXP, requiredXP: maxed ? 0 : SPHERE_XP_PER_LEVEL, remainingXP: maxed ? 0 : SPHERE_XP_PER_LEVEL - currentXP, progress: maxed ? 100 : currentXP / SPHERE_XP_PER_LEVEL * 100 };
}

/**
 * Уровень сферы для показа игроку (0.89.12). Сфера, в которой уже есть проект с задачами, начинается
 * с LVL 1, а не с 0: первая ступень охватывает 0–399 XP, дальше уровни идут как обычно (LVL 2 — 400 XP).
 * Только отображение: открытие зданий, комнат, навыков и достижения считаются по `sphereProgress`.
 */
export function shownSphereProgress(
  state: { spheres: Record<string, { xp: number }>; goals: { id: string; sphere: string }[]; quests: { goalId?: string; sphere: string }[] },
  id: string,
) {
  const base = sphereProgress(state.spheres[id]?.xp ?? 0);
  const started = state.goals.some((g) => g.sphere === id && state.quests.some((q) => q.goalId === g.id));
  if (!started || base.level > 1) return base;
  const required = 2 * SPHERE_XP_PER_LEVEL;
  const current = Math.min(base.totalXP, required);
  return { ...base, level: 1, currentXP: current, requiredXP: required, remainingXP: required - current, progress: (current / required) * 100 };
}
